import { z } from "zod";
import { stringList, techDecisionSchema } from "./definition";

/* ------------------------------------------------------------------ */
/* Rich document model — PRD, Agent Instructions (PRD §14, §26, §34)   */
/* ------------------------------------------------------------------ */

export const docBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({ type: z.literal("bullets"), items: stringList }),
  z.object({ type: z.literal("steps"), items: stringList }),
  z.object({
    type: z.literal("table"),
    columns: stringList,
    rows: z.array(z.array(z.string())),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "warning"]).default("info"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("code"),
    language: z.string().default(""),
    code: z.string().min(1),
  }),
]);
export type DocBlock = z.infer<typeof docBlockSchema>;

export const docSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(docBlockSchema).default([]),
});
export type DocSection = z.infer<typeof docSectionSchema>;

export const documentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(""),
  sections: z.array(docSectionSchema).default([]),
});
export type SpecDocument = z.infer<typeof documentSchema>;

/* ------------------------------------------------------------------ */
/* Feature specification (PRD §15)                                    */
/* ------------------------------------------------------------------ */

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});
export type Requirement = z.infer<typeof requirementSchema>;

export const featureSpecSchema = z.object({
  id: z.string().min(1),
  prefix: z.string().min(2),
  name: z.string().min(1),
  purpose: z.string().default(""),
  actors: stringList.default([]),
  mainFlow: stringList.default([]),
  requirements: z.array(requirementSchema).default([]),
  businessRules: stringList.default([]),
  edgeCases: stringList.default([]),
  acceptanceCriteria: stringList.default([]),
});
export type FeatureSpec = z.infer<typeof featureSpecSchema>;

/* ------------------------------------------------------------------ */
/* User flows (PRD §16)                                               */
/* ------------------------------------------------------------------ */

export const userFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  featureId: z.string().default(""),
  primaryActor: z.string().default(""),
  trigger: z.string().default(""),
  steps: stringList.default([]),
  outcome: z.string().default(""),
});
export type UserFlow = z.infer<typeof userFlowSchema>;

/* ------------------------------------------------------------------ */
/* Technical architecture (PRD §17)                                   */
/* ------------------------------------------------------------------ */

export const architectureSpecSchema = z.object({
  overview: z.string().default(""),
  decisions: z.array(techDecisionSchema).default([]),
  systemBoundaries: z
    .object({ inside: stringList.default([]), outside: stringList.default([]) })
    .default({ inside: [], outside: [] }),
  dataFlow: stringList.default([]),
  externalServices: z
    .array(
      z.object({
        name: z.string().min(1),
        purpose: z.string().default(""),
        source: z.enum(["user-selected", "recommended", "undecided"]).default("recommended"),
      }),
    )
    .default([]),
  rules: stringList.default([]),
});
export type ArchitectureSpec = z.infer<typeof architectureSpecSchema>;

/* ------------------------------------------------------------------ */
/* Data model (PRD §18)                                               */
/* ------------------------------------------------------------------ */

export const entityFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  purpose: z.string().default(""),
  constraints: stringList.default([]),
});
export type EntityField = z.infer<typeof entityFieldSchema>;

export const entitySchema = z.object({
  name: z.string().min(1),
  purpose: z.string().default(""),
  fields: z.array(entityFieldSchema).default([]),
  notes: z.string().default(""),
});
export type Entity = z.infer<typeof entitySchema>;

export const relationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["1:1", "1:N", "N:M"]).default("1:N"),
  description: z.string().default(""),
});
export type Relationship = z.infer<typeof relationshipSchema>;

export const dataModelSpecSchema = z.object({
  overview: z.string().default(""),
  entities: z.array(entitySchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
});
export type DataModelSpec = z.infer<typeof dataModelSpecSchema>;

/* ------------------------------------------------------------------ */
/* API specification (PRD §19)                                        */
/* ------------------------------------------------------------------ */

export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const endpointSchema = z.object({
  id: z.string().min(1),
  method: httpMethodSchema,
  path: z.string().min(1),
  purpose: z.string().min(1),
  actor: z.string().default(""),
  authentication: z.enum(["required", "optional", "none"]).default("required"),
  featureId: z.string().default(""),
  request: z.string().default(""),
  response: z.string().default(""),
  errors: z
    .array(
      z.preprocess(
        (value) => (typeof value === "string" ? { status: value, meaning: "" } : value),
        z.object({ status: z.string().min(1), meaning: z.string().default("") }),
      ),
    )
    .default([]),
});
export type Endpoint = z.infer<typeof endpointSchema>;

export const apiSpecSchema = z.object({
  overview: z.string().default(""),
  authentication: z.string().default(""),
  endpoints: z.array(endpointSchema).default([]),
});
export type ApiSpec = z.infer<typeof apiSpecSchema>;

/* ------------------------------------------------------------------ */
/* Implementation tasks (PRD §21–25)                                  */
/* ------------------------------------------------------------------ */

export const taskTypeSchema = z.enum([
  "foundation",
  "frontend",
  "backend",
  "database",
  "integration",
  "testing",
  "documentation",
]);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: taskTypeSchema.default("frontend"),
  phase: z.string().min(1),
  featureId: z.string().default(""),
  dependencies: stringList.default([]),
  references: stringList.default([]),
  contextDocs: stringList.default([]),
  requirements: stringList.default([]),
  uiStates: stringList.default([]),
  acceptanceCriteria: stringList.default([]),
  optional: z.boolean().default(false),
});
export type ImplementationTask = z.infer<typeof taskSchema>;

export const FRONTEND_FIRST_PHASES = [
  "Project Foundation",
  "Frontend Foundation",
  "Frontend Features",
  "Frontend Completion",
  "Backend Foundation",
  "Backend Features",
  "Integration",
  "Testing & Validation",
] as const;

/* ------------------------------------------------------------------ */
/* Consistency validation (PRD §28)                                   */
/* ------------------------------------------------------------------ */

export const consistencyIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]).default("medium"),
  area: z.string().default("general"),
  summary: z.string().min(1),
  detail: z.string().default(""),
  artifacts: stringList.default([]),
  suggestion: z.string().default(""),
});
export type ConsistencyIssue = z.infer<typeof consistencyIssueSchema>;

export const consistencyReportSchema = z.object({
  checkedAt: z.number(),
  issues: z.array(consistencyIssueSchema).default([]),
});
export type ConsistencyReport = z.infer<typeof consistencyReportSchema>;
