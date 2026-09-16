import { z } from "zod";
import {
  apiSpecSchema,
  architectureSpecSchema,
  assetPlanSpecSchema,
  canonicalSpecSchema,
  consistencyReportSchema,
  dataModelSpecSchema,
  documentSchema,
  featureSpecSchema,
  taskSchema,
  uiDesignSpecSchema,
  userFlowSchema,
} from "./artifacts";
import {
  clarificationAnswerSchema,
  clarificationQuestionSchema,
  ideaAnalysisSchema,
  projectDefinitionSchema,
} from "./definition";

export const ARTIFACT_KEYS = [
  "prd",
  "features",
  "flows",
  "uiDesign",
  "assetPlan",
  "architecture",
  "dataModel",
  "api",
  "tasks",
  "agentInstructions",
] as const;

export type ArtifactKey = (typeof ARTIFACT_KEYS)[number];

export const ARTIFACT_META: Record<
  ArtifactKey,
  { label: string; description: string; fileName: string }
> = {
  prd: {
    label: "PRD",
    description: "Product requirements: problem, goals, users, features, business rules, non-goals.",
    fileName: "docs/PRD.md",
  },
  features: {
    label: "Feature Specifications",
    description: "One detailed specification per core feature with stable requirement IDs.",
    fileName: "docs/features/*.md",
  },
  flows: {
    label: "User Flows",
    description: "Step-by-step flows for the most important user interactions.",
    fileName: "docs/user-flows.md",
  },
  uiDesign: {
    label: "UI Design",
    description:
      "Visual direction, design tokens, component inventory, and every screen with its layout and states.",
    fileName: "docs/ui-design.md",
  },
  assetPlan: {
    label: "Asset Plan",
    description:
      "Icon systems, media placements, legal sources, licenses, local paths, and fallbacks.",
    fileName: "docs/asset-plan.md",
  },
  architecture: {
    label: "Architecture",
    description: "Stack decisions with their source, boundaries, data flow, and external services.",
    fileName: "docs/architecture.md",
  },
  dataModel: {
    label: "Data Model",
    description: "Entities, fields, constraints, and relationships.",
    fileName: "docs/data-model.md",
  },
  api: {
    label: "API Specification",
    description: "Endpoints with actors, auth, request/response shape, and error cases.",
    fileName: "docs/api.md",
  },
  tasks: {
    label: "Implementation Tasks",
    description: "Small executable tasks with dependencies and requirement references.",
    fileName: "tasks/TASK-*.md",
  },
  agentInstructions: {
    label: "Agent Instructions",
    description: "AGENTS.md rules for the coding agent.",
    fileName: "AGENTS.md",
  },
};

export const artifactStatusSchema = z.object({
  status: z.enum(["empty", "running", "ready", "failed", "stale"]),
  error: z.string().nullable().default(null),
  warnings: z.array(z.string()).default([]),
  updatedAt: z.number().nullable().default(null),
});
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;

export const projectStatusSchema = z.enum([
  "draft",
  "clarifying",
  "review",
  "generating",
  "ready",
]);

export function createDefaultArtifactStatus(): ProjectRecord["artifactStatus"] {
  const entry: ArtifactStatus = { status: "empty", error: null, warnings: [], updatedAt: null };
  return Object.fromEntries(ARTIFACT_KEYS.map((key) => [key, { ...entry }])) as ProjectRecord["artifactStatus"];
}

export const editLogEntrySchema = z.object({
  id: z.string(),
  instruction: z.string(),
  summary: z.string().default(""),
  at: z.number(),
  scope: z.string().default("definition"),
  affected: z.array(z.string()).default([]),
  succeeded: z.boolean().default(true),
});
export type EditLogEntry = z.infer<typeof editLogEntrySchema>;

export const projectArtifactsSchema = z.object({
  prd: documentSchema.nullable().default(null),
  features: z.array(featureSpecSchema).default([]),
  flows: z.array(userFlowSchema).default([]),
  uiDesign: uiDesignSpecSchema.nullable().default(null),
  assetPlan: assetPlanSpecSchema.nullable().default(null),
  architecture: architectureSpecSchema.nullable().default(null),
  dataModel: dataModelSpecSchema.nullable().default(null),
  api: apiSpecSchema.nullable().default(null),
  tasks: z.array(taskSchema).default([]),
  agentInstructions: documentSchema.nullable().default(null),
  canonical: canonicalSpecSchema.default(() => canonicalSpecSchema.parse({})),
});
export type ProjectArtifacts = z.infer<typeof projectArtifactsSchema>;

export const projectRecordSchema = z.object({
  id: z.string().min(1),
  idea: z.string().min(1),
  status: projectStatusSchema.default("draft"),
  createdAt: z.number(),
  updatedAt: z.number(),
  analysis: ideaAnalysisSchema.nullable().default(null),
  questions: z.array(clarificationQuestionSchema).default([]),
  answers: z.array(clarificationAnswerSchema).default([]),
  definition: projectDefinitionSchema.nullable().default(null),
  artifacts: projectArtifactsSchema.default(() => projectArtifactsSchema.parse({})),
  artifactStatus: z
    .record(z.enum(ARTIFACT_KEYS), artifactStatusSchema)
    .default(() => createDefaultArtifactStatus()),
  validation: consistencyReportSchema.nullable().default(null),
  editHistory: z.array(editLogEntrySchema).default([]),
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

/* ------------------------------------------------------------------ */
/* Local application settings (PRD §31)                               */
/* ------------------------------------------------------------------ */

export const providerModeSchema = z.enum(["live", "demo"]);

export const providerSettingsSchema = z.object({
  baseUrl: z.string().default(""),
  apiKey: z.string().default(""),
  model: z.string().default(""),
  mode: providerModeSchema.default("demo"),
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

export const appSettingsSchema = z.object({
  provider: providerSettingsSchema.default({
    baseUrl: "",
    apiKey: "",
    model: "",
    mode: "demo",
  }),
  documentLanguage: z.literal("en").default("en"),
  strategyOverrideAcknowledged: z.boolean().default(false),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;
