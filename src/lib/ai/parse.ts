import type { z } from "zod";
import { AiError } from "./provider";

/**
 * Extracts the first balanced JSON value from a model response and validates it
 * against a schema. If validation fails the caller can retry once with the
 * validation errors, which keeps weak models usable without weakening the state
 * model (PRD §34).
 */

export function extractJson(raw: string): unknown {
  const cleaned = stripCodeFence(raw).trim();
  const direct = tryParse(cleaned);
  if (direct.ok) return direct.value;

  const start = findFirstJsonStart(cleaned);
  if (start === -1) {
    throw new AiError("invalid-json", "Respons model tidak mengandung JSON yang bisa dibaca.", 502);
  }

  const candidate = extractBalanced(cleaned, start);
  if (!candidate) {
    throw new AiError("invalid-json", "JSON dari model terpotong atau tidak seimbang.", 502);
  }

  const parsed = tryParse(candidate);
  if (parsed.ok) return parsed.value;

  throw new AiError(
    "invalid-json",
    `JSON dari model tidak dapat di-parse: ${truncate(parsed.error, 240)}`,
    502,
  );
}

export interface RepairRequest {
  /** What went wrong: a JSON syntax problem or a list of schema violations. */
  problem: string;
  /** The provider stopped early because the answer did not fit in the output limit. */
  truncated: boolean;
}

export async function parseWithSchema<T>(
  schema: z.ZodType<T>,
  raw: string,
  options?: {
    repair?: (request: RepairRequest) => Promise<string>;
    step?: string;
    truncated?: boolean;
  },
): Promise<T> {
  const stepName = options?.step ?? "step";
  const repair = options?.repair;
  const truncated = Boolean(options?.truncated);

  let value: unknown;
  try {
    value = extractJson(raw);
  } catch (error) {
    const problem = error instanceof Error ? error.message : "JSON tidak valid.";
    if (!repair) throw error;

    const repairedRaw = await repair({ problem, truncated });
    try {
      return schema.parse(extractJson(repairedRaw));
    } catch (secondError) {
      throw new AiError(
        "invalid-json",
        `Output model tidak bisa dibaca bahkan setelah diminta ulang (${stepName}): ${problem}`,
        502,
      );
    }
  }

  const first = schema.safeParse(value);
  if (first.success) return first.data;

  const problem = summarizeIssues(first.error);
  if (repair) {
    const repairedRaw = await repair({ problem, truncated });
    const second = schema.safeParse(extractJson(repairedRaw));
    if (second.success) return second.data;
    throw new AiError(
      "invalid-schema",
      `Output AI tidak sesuai skema setelah perbaikan (${stepName}): ${summarizeIssues(second.error)}`,
      502,
    );
  }

  throw new AiError(
    "invalid-schema",
    `Output AI tidak sesuai skema (${stepName}): ${problem}`,
    502,
  );
}

export function summarizeIssues(error: z.ZodError, limit = 6) {
  return error.issues
    .slice(0, limit)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^\s*```(?:json|JSON)?\s*/, "")
    .replace(/\s*```\s*$/, "");
}

function tryParse(value: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function findFirstJsonStart(value: string) {
  const objectStart = value.indexOf("{");
  const arrayStart = value.indexOf("[");
  if (objectStart === -1) return arrayStart;
  if (arrayStart === -1) return objectStart;
  return Math.min(objectStart, arrayStart);
}

function extractBalanced(value: string, start: number) {
  const openChar = value[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return null;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
