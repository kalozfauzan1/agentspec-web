export type ProviderMode = "live" | "demo";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: ProviderMode;
}

export const DEFAULT_BASE_URL = "https://9router.nalarlabs.tech/v1";
export const DEFAULT_MODEL = "first";

/**
 * Model routing by stage: quality is a multiplier, but source-of-truth +
 * validation must prevent corruption even with weaker models.
 * Strong reasoning: interpretation, canonical spec, API/domain/data-model,
 * tasks, semantic audit. Fast: PRD expansion, UI docs, formatting.
 */
const STEP_MODEL_TIER: Record<string, "strong" | "fast" | "strongest"> = {
  analyze: "strong",
  definition: "strong",
  features: "strong",
  prd: "fast",
  flows: "fast",
  uiDesign: "fast",
  assetPlan: "fast",
  architecture: "strong",
  dataModel: "strong",
  api: "strong",
  tasks: "strong",
  validate: "strongest",
  edit: "strong",
  agentInstructions: "fast",
  clarify: "fast",
};

export function modelTierForStep(step: string): "strong" | "fast" | "strongest" {
  return STEP_MODEL_TIER[step] ?? "strong";
}

export function modelForStep(baseModel: string, step: string): string {
  // Per-step override via env: AGENTSPEC_MODEL_VALIDATE, etc.
  const override = process.env[`AGENTSPEC_MODEL_${step.toUpperCase()}`]?.trim();
  if (override) return override;
  return baseModel;
}

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

/**
 * Total provider budget must stay under the API route maxDuration (300s).
 * Per-attempt 90s × max 2 timeout retries ≈ 180s + backoff < 300s, so the
 * server returns a controlled JSON error instead of a raw gateway 504.
 */
const PROVIDER_ATTEMPT_TIMEOUT_MS = 90_000;
const PROVIDER_MAX_TIMEOUT_ATTEMPTS = 2;

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
  let timeoutAttempts = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? PROVIDER_ATTEMPT_TIMEOUT_MS,
    );
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
        // Gateway timeouts (504) from an overloaded provider should not be
        // retried at full force — back off longer so the next attempt lands
        // after the provider recovers.
        if (RETRYABLE_STATUS.has(response.status) && attempt < attempts) {
          lastError = new AiError(
            "provider-busy",
            response.status === 504
              ? "Provider AI kehabisan waktu (504). Menunggu lebih lama lalu mencoba ulang…"
              : `Provider merespons ${response.status}. Mencoba ulang…`,
            response.status,
          );
          await wait(attempt * 1500 + Math.floor(Math.random() * 1000));
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
        timeoutAttempts += 1;
        lastError = new AiError(
          "timeout",
          "Provider AI melebihi batas waktu 90 detik. Coba generate ulang dokumen ini saja (tombol retry per dokumen).",
          504,
        );
        // Timeouts already consumed ~90s each; cap retries so the total stays
        // under the server maxDuration instead of cascading into a gateway 504.
        if (attempt < attempts && timeoutAttempts < PROVIDER_MAX_TIMEOUT_ATTEMPTS) {
          await wait(attempt * 2000);
          continue;
        }
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
