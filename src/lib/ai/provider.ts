export type ProviderMode = "live" | "demo";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: ProviderMode;
  /** Models tried in order when the primary one is unavailable. */
  fallbackModels?: string[];
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

/**
 * Models to fall back to when the primary one reports that it is unavailable
 * (quota exhausted, provider down). `AI_FALLBACK_MODELS` overrides the default;
 * an empty value disables the fallback entirely.
 */
function envFallbackModels(baseUrl: string): string[] {
  const configured = process.env.AI_FALLBACK_MODELS;
  if (configured !== undefined) {
    return configured.split(",").map((model) => model.trim()).filter(Boolean);
  }
  // The bundled gateway exposes an auto-routing model; only use it for the
  // built-in endpoint so a custom provider never receives an unknown model name.
  return baseUrl === DEFAULT_BASE_URL ? [DEFAULT_MODEL] : [];
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
  const fallbackModels = envFallbackModels(baseUrl);

  if (requestedMode === "demo") {
    return { baseUrl, apiKey, model, mode: "demo", fallbackModels };
  }

  if (!apiKey) {
    throw new AiError(
      "missing-credentials",
      "Kredensial AI belum dikonfigurasi. Isi API key di halaman Settings atau jalankan mode Demo.",
      400,
    );
  }

  return { baseUrl, apiKey, model, mode: "live", fallbackModels };
}

interface CallOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Absolute `Date.now()` timestamp after which no new attempt may start. */
  deadline?: number;
}

export interface ModelResult {
  content: string;
  finishReason: string | null;
  /** True when the provider stopped because it ran out of output tokens. */
  truncated: boolean;
  /** Model that produced the answer — differs from the request after a fallback. */
  model: string;
}

const RETRYABLE_STATUS = new Set([402, 408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Large artifacts (feature specs, task lists) need much more room than the
 * default; when the provider stops early we report it so the caller can ask for
 * a complete but more compact answer instead of failing the step.
 */
const DEFAULT_MAX_TOKENS = 16_000;

/**
 * A full 16k-token artifact takes ~110s on the bundled gateway, so the previous
 * 90s cap aborted long answers mid-flight and threw them away — that abort is
 * what surfaced as a "timeout" on the tasks step. Attempts now get 150s, and
 * every attempt of a step draws from one budget that stays under the API route
 * maxDuration (300s) and the client-side timeout (285s).
 */
const PROVIDER_ATTEMPT_TIMEOUT_MS = 150_000;
const PROVIDER_TOTAL_BUDGET_MS = 265_000;
/** An attempt shorter than this cannot deliver a usable answer, so stop instead. */
const PROVIDER_MIN_ATTEMPT_MS = 20_000;
/** Attempts per model for retryable failures (5xx, empty answers). */
const PROVIDER_ATTEMPTS_PER_MODEL = 2;
/**
 * A provider that asks us to wait longer than this is out of quota or down.
 * Sleeping inside the request would only burn the step budget, so the next
 * model is tried instead (and when none is left, the step fails fast).
 */
const PROVIDER_RETRY_AFTER_LIMIT_MS = 20_000;

function candidateModels(config: ProviderConfig) {
  const seen = new Set<string>();
  return [config.model, ...(config.fallbackModels ?? [])]
    .map((model) => model.trim())
    .filter((model) => {
      if (!model || seen.has(model)) return false;
      seen.add(model);
      return true;
    });
}

/** `Retry-After` is either a number of seconds or an HTTP date. */
function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after")?.trim();
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function unavailableMessage(model: string, waitMs: number) {
  return (
    `Provider AI tidak tersedia untuk model "${model}" dan baru pulih dalam ±${formatDuration(waitMs)}. ` +
    "Percobaan dihentikan supaya waktu dan kuota tidak terbuang — coba lagi setelah waktu tersebut, " +
    "atau pakai model lain di halaman Settings."
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} detik`;
  return seconds === 0 ? `${minutes} menit` : `${minutes} menit ${seconds} detik`;
}

export async function callModel(config: ProviderConfig, options: CallOptions): Promise<ModelResult> {
  const models = candidateModels(config);
  const deadline = options.deadline ?? Date.now() + PROVIDER_TOTAL_BUDGET_MS;
  let lastError: unknown = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS_PER_MODEL; attempt += 1) {
      const remaining = deadline - Date.now();
      const attemptTimeout = Math.min(options.timeoutMs ?? PROVIDER_ATTEMPT_TIMEOUT_MS, remaining);
      if (attemptTimeout < PROVIDER_MIN_ATTEMPT_MS) {
        throw lastError instanceof AiError
          ? lastError
          : new AiError(
              "timeout",
              `Provider AI melebihi batas waktu ${formatDuration(PROVIDER_TOTAL_BUDGET_MS)}. Coba generate ulang dokumen ini saja (tombol retry per dokumen).`,
              504,
            );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), attemptTimeout);
      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: options.system },
              { role: "user", content: options.user },
            ],
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            stream: false,
            ...(options.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const raw = await response.text();
          if (!RETRYABLE_STATUS.has(response.status)) {
            throw new AiError(
              "provider-error",
              `Provider AI menolak permintaan (${response.status}): ${truncate(raw, 400)}`,
              response.status,
            );
          }
          const retryAfter = retryAfterMs(response);
          if (retryAfter !== null && retryAfter > PROVIDER_RETRY_AFTER_LIMIT_MS) {
            lastError = new AiError(
              "provider-unavailable",
              unavailableMessage(model, retryAfter),
              503,
            );
            break;
          }
          lastError = new AiError(
            "provider-busy",
            response.status === 504
              ? "Provider AI kehabisan waktu (504)."
              : `Provider AI merespons ${response.status}.`,
            response.status,
          );
          if (attempt < PROVIDER_ATTEMPTS_PER_MODEL) {
            await wait(attempt * 1500 + Math.floor(Math.random() * 1000));
            continue;
          }
          break;
        }

        const payload = (await response.json()) as {
          choices?: {
            message?: { content?: string | null };
            finish_reason?: string | null;
          }[];
          error?: { message?: string };
        };

        if (payload.error?.message) {
          lastError = new AiError("provider-error", payload.error.message, 502);
          if (attempt < PROVIDER_ATTEMPTS_PER_MODEL) {
            await wait(attempt * 1000);
            continue;
          }
          break;
        }

        const choice = payload.choices?.[0];
        const content = choice?.message?.content;
        const finishReason = choice?.finish_reason ?? null;

        if (!content || !content.trim()) {
          lastError = new AiError("empty-response", "Model mengembalikan respons kosong.", 502);
          if (attempt < PROVIDER_ATTEMPTS_PER_MODEL) {
            await wait(attempt * 1000);
            continue;
          }
          break;
        }

        return {
          content,
          finishReason,
          truncated: finishReason === "length" || finishReason === "max_tokens",
          model,
        };
      } catch (error) {
        if (error instanceof AiError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          // A stalled model rarely recovers inside the same request, so report
          // it and let the next model take over instead of waiting again.
          lastError = new AiError(
            "timeout",
            `Model "${model}" tidak merespons dalam ${formatDuration(attemptTimeout)}. Coba generate ulang dokumen ini saja (tombol retry per dokumen), atau pakai model lain di halaman Settings.`,
            504,
          );
          break;
        }
        lastError = error;
        if (attempt < PROVIDER_ATTEMPTS_PER_MODEL) {
          await wait(attempt * 1000);
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
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
