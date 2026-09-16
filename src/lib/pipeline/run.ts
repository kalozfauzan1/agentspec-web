import {
  ARTIFACT_META,
  type ArtifactKey,
  type ArtifactStatus,
  type ImplementationTask,
  type ProjectArtifacts,
  type ProjectRecord,
  type ProviderSettings,
} from "@/lib/schemas";
import { providerOverrideHeaders } from "@/lib/store/settings-store";
import { normalizeTasks } from "@/lib/ai/normalize";
import { rebaseTaskIds, taskBatchStages } from "@/lib/ai/task-batches";

export type PipelineStage = ArtifactKey | "definition" | "validation";

export interface PipelineProgress {
  label: string;
  value: number;
}

export const ARTIFACT_ORDER: ArtifactKey[] = [
  "features",
  "prd",
  "flows",
  "architecture",
  "uiDesign",
  "assetPlan",
  "dataModel",
  "api",
  "tasks",
  "agentInstructions",
];

/**
 * Features are generated before the PRD so the PRD can reference stable
 * requirement ids and stay traceable to the feature specifications (PRD §28).
 * Architecture is generated before the UI design so the design can honour the
 * platform and framework decisions. The UI design and asset plan are generated
 * before the tasks so the task planner can require documented screens,
 * components, states, and sourced assets.
 */
const ARTIFACT_DEPENDENCIES: Record<ArtifactKey, ArtifactKey[]> = {
  features: [],
  prd: ["features"],
  flows: ["features"],
  uiDesign: ["features", "architecture"],
  assetPlan: ["uiDesign", "architecture"],
  architecture: [],
  dataModel: ["features"],
  api: ["features", "dataModel"],
  tasks: ["architecture", "uiDesign", "assetPlan"],
  agentInstructions: ["tasks", "uiDesign", "assetPlan"],
};

export function expandArtifactSet(keys: ArtifactKey[]): ArtifactKey[] {
  const plan = new Set<ArtifactKey>();
  const add = (key: ArtifactKey) => {
    if (plan.has(key)) return;
    for (const dependency of ARTIFACT_DEPENDENCIES[key]) add(dependency);
    plan.add(key);
  };
  keys.forEach(add);
  return ARTIFACT_ORDER.filter((key) => plan.has(key));
}

export class StepError extends Error {
  code: string;
  constructor(message: string, code = "step-failed") {
    super(message);
    this.name = "StepError";
    this.code = code;
  }
}

const STEP_TIMEOUT_MS = 285_000;
const STEP_RETRYABLE_CODES = new Set(["step-failed", "provider-busy", "timeout", "gateway-timeout"]);
const STEP_RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function callStep<T>(
  step: string,
  body: Record<string, unknown>,
  provider: ProviderSettings,
): Promise<T & { warnings?: string[] }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.mode === "live") {
    Object.assign(headers, providerOverrideHeaders(provider));
  }

  let lastError: StepError | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/ai/${step}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: provider.mode, ...body }),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : `Permintaan gagal (${response.status}).`;
        const code =
          payload && typeof payload === "object" && "code" in payload
            ? String((payload as { code: unknown }).code)
            : "step-failed";
        lastError = new StepError(friendlyStepMessage(response.status, code, message), code);
        if (
          attempt < 2 &&
          (STEP_RETRYABLE_STATUS.has(response.status) || STEP_RETRYABLE_CODES.has(code))
        ) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }
        throw lastError;
      }

      return payload as T & { warnings?: string[] };
    } catch (error) {
      if (error instanceof StepError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new StepError(
          `Langkah "${step}" melebihi batas waktu. Coba generate ulang dokumen ini saja.`,
          "gateway-timeout",
        );
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }
        throw lastError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new StepError("Langkah gagal.", "step-failed");
}

function friendlyStepMessage(status: number, code: string, message: string) {
  if (status === 504 || code === "timeout" || code === "gateway-timeout") {
    return `Langkah memakan waktu terlalu lama (504). Progress yang sudah jadi tidak hilang — coba generate ulang dokumen ini saja. Detail: ${message}`;
  }
  return message;
}

function bodyForArtifact(key: ArtifactKey, project: ProjectRecord) {
  const definition = project.definition;
  const { features, architecture, dataModel, tasks, uiDesign, assetPlan, api, flows } =
    project.artifacts;

  switch (key) {
    case "features":
      return { definition };
    case "prd":
      return { definition, features };
    case "flows":
      return { definition, features };
    case "uiDesign":
      return { definition, features, architecture };
    case "assetPlan":
      return { definition, features, architecture, uiDesign };
    case "architecture":
      return { definition };
    case "dataModel":
      return { definition, features };
    case "api":
      return { definition, features, dataModel, architecture };
    case "tasks":
      // Tasks stabilize last: they need canonical API + data model + flows
      // so they REFER to operationIds/tables instead of inventing them.
      return { definition, features, architecture, uiDesign, assetPlan, dataModel, api, flows };
    case "agentInstructions":
      return { definition, architecture, tasks, uiDesign, assetPlan };
  }
}

export interface ArtifactRunResult {
  key: ArtifactKey;
  status: ArtifactStatus["status"];
  error: string | null;
  patch: Partial<ProjectArtifacts>;
  warnings: string[];
}

export interface TasksBatchProgress {
  done: number;
  total: number;
  label: string;
}

export interface RunArtifactHooks {
  /** Fired after every tasks batch lands so the UI can persist partial work. */
  onTasksBatch?: (
    partial: ImplementationTask[],
    progress: TasksBatchProgress,
  ) => void | Promise<void>;
}

async function runArtifact(
  key: ArtifactKey,
  project: ProjectRecord,
  provider: ProviderSettings,
  hooks: RunArtifactHooks = {},
): Promise<ArtifactRunResult> {
  // Tasks are generated batch-by-batch over separate HTTP requests (one LLM
  // call per request) so a 504 can only ever lose a single batch — the rest
  // is already persisted. Demo mode stays on the single legacy call.
  if (key === "tasks" && provider.mode === "live") {
    return runTasksBatched(project, provider, hooks);
  }

  const response = await callStep<Record<string, unknown>>(
    key,
    bodyForArtifact(key, project),
    provider,
  );
  const warnings = Array.isArray(response.warnings) ? response.warnings : [];

  switch (key) {
    case "prd":
      return { key, status: "ready", error: null, patch: { prd: response.prd as ProjectArtifacts["prd"] }, warnings };
    case "features":
      return { key, status: "ready", error: null, patch: { features: response.features as ProjectArtifacts["features"] }, warnings };
    case "flows":
      return { key, status: "ready", error: null, patch: { flows: response.flows as ProjectArtifacts["flows"] }, warnings };
    case "uiDesign":
      return { key, status: "ready", error: null, patch: { uiDesign: response.uiDesign as ProjectArtifacts["uiDesign"] }, warnings };
    case "assetPlan":
      return { key, status: "ready", error: null, patch: { assetPlan: response.assetPlan as ProjectArtifacts["assetPlan"] }, warnings };
    case "architecture":
      return { key, status: "ready", error: null, patch: { architecture: response.architecture as ProjectArtifacts["architecture"] }, warnings };
    case "dataModel":
      return { key, status: "ready", error: null, patch: { dataModel: response.dataModel as ProjectArtifacts["dataModel"] }, warnings };
    case "api":
      return { key, status: "ready", error: null, patch: { api: response.api as ProjectArtifacts["api"] }, warnings };
    case "tasks":
      return { key, status: "ready", error: null, patch: { tasks: response.tasks as ProjectArtifacts["tasks"] }, warnings };
    case "agentInstructions":
      return {
        key,
        status: "ready",
        error: null,
        patch: { agentInstructions: response.agentInstructions as ProjectArtifacts["agentInstructions"] },
        warnings,
      };
    default:
      throw new Error(`Unhandled artifact step "${String(key)}".`);
  }
}

export interface GenerateOptions {
  project: ProjectRecord;
  provider: ProviderSettings;
  keys: ArtifactKey[];
  onStageStart?: (stage: PipelineStage) => void;
  onResult?: (result: ArtifactRunResult) => void | Promise<void>;
  onProgress?: (progress: PipelineProgress) => void;
  onTasksBatch?: RunArtifactHooks["onTasksBatch"];
}

/**
 * Client-driven task planning: each batch is its own HTTP request carrying
 * the full project context (server slices the prompt per batch), so no
 * single request ever stacks 7+ LLM calls against the 300s server limit.
 * Every landed batch is published immediately; a failed batch only costs
 * itself and is retried on the next "generate tasks" run.
 */
export async function runTasksBatched(
  project: ProjectRecord,
  provider: ProviderSettings,
  hooks: RunArtifactHooks = {},
): Promise<ArtifactRunResult> {
  const definition = project.definition;
  if (!definition) {
    throw new StepError("Project definition belum dibuat.", "missing-definition");
  }
  const { features, architecture, dataModel, uiDesign, assetPlan, api } = project.artifacts;
  const body = { definition, features, architecture, uiDesign, assetPlan, dataModel, api };

  const stages = taskBatchStages(definition, features);
  const total = stages.flat().length;
  let done = 0;
  const collected: ImplementationTask[] = [];
  const warnings: string[] = [];
  const failedBatches: string[] = [];

  for (const stage of stages) {
    const knownTasks = collected.map((task) => ({ id: task.id, title: task.title }));
    const results: ImplementationTask[][] = new Array(stage.length).fill([]);

    const runOne = async (batchIndex: number) => {
      const batch = stage[batchIndex];
      try {
        const response = await callStep<{ tasks: ImplementationTask[]; warnings?: string[] }>(
          "tasksBatch",
          {
            ...body,
            batch: {
              index: done + batchIndex + 1,
              total,
              label: batch.label,
              phases: batch.phases,
              featureIds: batch.features.map((feature) => feature.id),
              knownTasks,
              nextTaskNumber: knownTasks.length + 1,
            },
          },
          provider,
        );
        results[batchIndex] = Array.isArray(response.tasks) ? response.tasks : [];
        if (Array.isArray(response.warnings)) warnings.push(...response.warnings);
        if (results[batchIndex].length === 0) {
          warnings.push(`Batch task "${batch.label}" tidak menghasilkan task apa pun.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch gagal.";
        failedBatches.push(batch.label);
        warnings.push(`Batch task "${batch.label}" gagal: ${message}`);
        results[batchIndex] = [];
      }
    };

    // Bounded concurrency: 2 overlapping requests keep batches flowing
    // without overloading the provider into a 504 cascade.
    let next = 0;
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(2, stage.length); w += 1) {
      workers.push(
        (async () => {
          while (next < stage.length) {
            const current = next;
            next += 1;
            await runOne(current);
            done += 1;
          }
        })(),
      );
    }
    await Promise.all(workers);

    for (const tasks of results) {
      collected.push(...rebaseTaskIds(tasks, collected.length + 1));
    }
    // Publish once per stage in index order so partial ids stay stable.
    await hooks.onTasksBatch?.(normalizeTasks([...collected], features, definition), {
      done,
      total,
      label: stage[stage.length - 1].label,
    });
  }

  if (collected.length === 0) {
    throw new StepError(
      "Model tidak menghasilkan task apa pun. Coba generate ulang Tasks saja.",
      "empty-artifact",
    );
  }

  const tasks = normalizeTasks(collected, features, definition);
  if (failedBatches.length > 0) {
    warnings.push(
      `${failedBatches.length} dari ${total} batch gagal (${failedBatches.join("; ")}). ` +
        "Tasks yang sudah jadi tersimpan — generate ulang Tasks untuk melengkapi sisanya.",
    );
  }
  for (const task of tasks) {
    if (task.references.length === 0 && task.featureId) {
      warnings.push(`${task.id} tidak punya rujukan requirement.`);
    }
  }
  return {
    key: "tasks",
    status: "ready",
    error: null,
    patch: { tasks },
    warnings: Array.from(new Set(warnings)).slice(0, 8),
  };
}

export async function generateArtifacts(options: GenerateOptions) {
  const { project, provider, keys, onResult, onStageStart, onProgress, onTasksBatch } = options;

  const requested = new Set(keys);
  const plan = expandArtifactSet(keys);
  // Prerequisites that are already generated are only inputs, not work items.
  const work = plan.filter(
    (key) => requested.has(key) || project.artifactStatus[key]?.status !== "ready",
  );

  let current = project;
  const failed: ArtifactKey[] = [];
  const skipped: ArtifactKey[] = [];
  const warnings: string[] = [];

  for (const [index, key] of work.entries()) {
    const blockedBy = ARTIFACT_DEPENDENCIES[key].filter(
      (dependency) => failed.includes(dependency) || skipped.includes(dependency),
    );

    onStageStart?.(key);
    onProgress?.({
      label: ARTIFACT_META[key].label,
      value: Math.round((index / Math.max(1, work.length)) * 100),
    });

    if (blockedBy.length > 0) {
      skipped.push(key);
      const message = `Dilewati karena ${blockedBy.join(", ")} gagal.`;
      warnings.push(`${key}: ${message}`);
      const result: ArtifactRunResult = {
        key,
        status: "failed",
        error: message,
        patch: {},
        warnings: [message],
      };
      await onResult?.(result);
      continue;
    }

    try {
      const result = await runArtifact(key, current, provider, {
        onTasksBatch: async (partial, progress) => {
          current = {
            ...current,
            artifacts: { ...current.artifacts, tasks: partial },
          };
          await onTasksBatch?.(partial, progress);
        },
      });
      warnings.push(...result.warnings);
      current = {
        ...current,
        artifacts: { ...current.artifacts, ...result.patch },
      };
      await onResult?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Langkah gagal.";
      failed.push(key);
      const result: ArtifactRunResult = {
        key,
        status: "failed",
        error: message,
        patch: {},
        warnings: [message],
      };
      warnings.push(`${key}: ${message}`);
      await onResult?.(result);
    }
  }

  onProgress?.({ label: "selesai", value: 100 });
  return { failed, skipped, warnings, project: current };
}

export async function runValidationStep(project: ProjectRecord, provider: ProviderSettings) {
  const response = await callStep<{ issues: unknown[]; warnings?: string[] }>(
    "validate",
    {
      definition: project.definition,
      features: project.artifacts.features,
      flows: project.artifacts.flows,
      uiDesign: project.artifacts.uiDesign,
      assetPlan: project.artifacts.assetPlan,
      architecture: project.artifacts.architecture,
      dataModel: project.artifacts.dataModel,
      api: project.artifacts.api,
      tasks: project.artifacts.tasks,
      prd: project.artifacts.prd,
      agentInstructions: project.artifacts.agentInstructions,
    },
    provider,
  );

  return {
    issues: (response.issues ?? []) as NonNullable<ProjectRecord["validation"]>["issues"],
    warnings: response.warnings ?? [],
  };
}
