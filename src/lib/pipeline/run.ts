import {
  ARTIFACT_META,
  type ArtifactKey,
  type ArtifactStatus,
  type ProjectArtifacts,
  type ProjectRecord,
  type ProviderSettings,
} from "@/lib/schemas";
import { providerOverrideHeaders } from "@/lib/store/settings-store";

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

export async function callStep<T>(
  step: string,
  body: Record<string, unknown>,
  provider: ProviderSettings,
): Promise<T & { warnings?: string[] }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.mode === "live") {
    Object.assign(headers, providerOverrideHeaders(provider));
  }

  const response = await fetch(`/api/ai/${step}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: provider.mode, ...body }),
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
    throw new StepError(message, code);
  }

  return payload as T & { warnings?: string[] };
}

function bodyForArtifact(key: ArtifactKey, project: ProjectRecord) {
  const definition = project.definition;
  const { features, architecture, dataModel, tasks, uiDesign, assetPlan } = project.artifacts;

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
      return { definition, features, architecture, uiDesign, assetPlan };
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

async function runArtifact(
  key: ArtifactKey,
  project: ProjectRecord,
  provider: ProviderSettings,
): Promise<ArtifactRunResult> {
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
}

export async function generateArtifacts(options: GenerateOptions) {
  const { project, provider, keys, onResult, onStageStart, onProgress } = options;

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
      const result = await runArtifact(key, current, provider);
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
