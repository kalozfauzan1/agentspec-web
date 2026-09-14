export type ProviderMode = "live" | "demo";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: ProviderMode;
}

export const DEFAULT_BASE_URL = "https://9router.nalarlabs.tech/v1";
export const DEFAULT_MODEL = "first";

export class AiError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 500) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function envBaseUrl() {
  return (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function envApiKey() {
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
}

function envModel() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

export function serverProviderStatus() {
  const configured = Boolean(envApiKey());
  return {
    configured,
    baseUrl: envBaseUrl(),
    model: envModel(),
    mode: (configured ? "live" : "demo") as ProviderMode,
  };
}

export function resolveProvider(
  headers: Headers,
  requestedMode?: ProviderMode,
): ProviderConfig {
  const overrideBaseUrl = headers.get("x-agentspec-base-url")?.trim() ?? "";
  const overrideApiKey = headers.get("x-agentspec-api-key")?.trim() ?? "";
  const overrideModel = headers.get("x-agentspec-model")?.trim() ?? "";

  const apiKey = overrideApiKey || envApiKey();
  const baseUrl = (overrideBaseUrl || envBaseUrl()).replace(/\/+$/, "");
  const model = overrideModel || envModel();

  if (requestedMode === "demo") {
    return { baseUrl, apiKey, model, mode: "demo" };
  }

  if (!apiKey) {
    throw new AiError(
      "missing-credentials",
      "Kredensial AI belum dikonfigurasi. Isi API key di halaman Settings atau jalankan mode Demo.",
      400,
    );
  }

  return { baseUrl, apiKey, model, mode: "live" };
}

interface CallOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ModelResult {
  content: string;
  finishReason: string | null;
  /** True when the provider stopped because it ran out of output tokens. */
  truncated: boolean;
}

const RETRYABLE_STATUS = new Set([402, 408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Large artifacts (feature specs, task lists) need much more room than the
 * default; when the provider stops early we report it so the caller can ask for
 * a complete but more compact answer instead of failing the step.
 */
const DEFAULT_MAX_TOKENS = 16_000;

export async function callModel(config: ProviderConfig, options: CallOptions): Promise<ModelResult> {
  const body = {
    model: config.model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: false,
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
  };

  const attempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        if (RETRYABLE_STATUS.has(response.status) && attempt < attempts) {
          lastError = new AiError(
            "provider-busy",
            `Provider merespons ${response.status}. Mencoba ulang…`,
            response.status,
          );
          await wait(attempt * 1500);
          continue;
        }
        throw new AiError(
          "provider-error",
          `Provider AI menolak permintaan (${response.status}): ${truncate(raw, 400)}`,
          response.status,
        );
      }

      const payload = (await response.json()) as {
        choices?: {
          message?: { content?: string | null };
          finish_reason?: string | null;
        }[];
        error?: { message?: string };
      };

      if (payload.error?.message) {
        throw new AiError("provider-error", payload.error.message, 502);
      }

      const choice = payload.choices?.[0];
      const content = choice?.message?.content;
      const finishReason = choice?.finish_reason ?? null;

      if (!content || !content.trim()) {
        if (attempt < attempts) {
          lastError = new AiError("empty-response", "Model mengembalikan respons kosong.", 502);
          await wait(attempt * 1000);
          continue;
        }
        throw new AiError("empty-response", "Model mengembalikan respons kosong.", 502);
      }

      return {
        content,
        finishReason,
        truncated: finishReason === "length" || finishReason === "max_tokens",
      };
    } catch (error) {
      if (error instanceof AiError && error.httpStatus === 502) {
        lastError = error;
        if (attempt < attempts) {
          await wait(attempt * 1000);
          continue;
        }
        throw error;
      }
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new AiError("timeout", "Permintaan ke provider AI melebihi batas waktu.", 504);
        if (attempt < attempts) continue;
        throw lastError;
      }
      lastError = error;
      if (attempt < attempts) {
        await wait(attempt * 1000);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof AiError
    ? lastError
    : new AiError("unknown", "Gagal menghubungi provider AI.", 502);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
