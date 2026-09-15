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

export const uiSurfaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().default(""),
  states: stringList.default([]),
});
export type UiSurface = z.infer<typeof uiSurfaceSchema>;

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
  userFacing: z.boolean().default(true),
  uiSurfaces: z.array(uiSurfaceSchema).default([]),
  mediaRequirements: stringList.default([]),
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
  screenIds: stringList.default([]),
  assetIds: stringList.default([]),
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
/* UI design specification (PRD §12, §22)                             */
/* ------------------------------------------------------------------ */

export const designTokenSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  usage: z.string().default(""),
});
export type DesignToken = z.infer<typeof designTokenSchema>;

export const typographyTokenSchema = z.object({
  role: z.string().min(1),
  size: z.string().min(1),
  weight: z.string().default("400"),
  lineHeight: z.string().default("1.5"),
  usage: z.string().default(""),
});
export type TypographyToken = z.infer<typeof typographyTokenSchema>;

export const breakpointSchema = z.object({
  name: z.string().min(1),
  width: z.string().min(1),
  behavior: z.string().default(""),
});
export type Breakpoint = z.infer<typeof breakpointSchema>;

export const designComponentSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().default(""),
  variants: stringList.default([]),
  states: stringList.default([]),
  rules: stringList.default([]),
});
export type DesignComponent = z.infer<typeof designComponentSchema>;

export const designScreenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  featureId: z.string().default(""),
  purpose: z.string().default(""),
  layout: stringList.default([]),
  components: stringList.default([]),
  states: stringList.default([]),
  responsive: stringList.default([]),
  sampleContent: stringList.default([]),
  assetIds: stringList.default([]),
});
export type DesignScreen = z.infer<typeof designScreenSchema>;

export const signatureMomentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  screenIds: stringList.default([]),
});
export type SignatureMoment = z.infer<typeof signatureMomentSchema>;

export const fontFamilySchema = z.object({
  family: z.string().min(1),
  source: z.string().default(""),
  fallback: z.string().default(""),
  weights: stringList.default([]),
});
export type FontFamily = z.infer<typeof fontFamilySchema>;

export const platformProfileSchema = z.object({
  platform: z.string().min(1),
  navigation: z.string().min(1),
  units: z.string().min(1),
  inputModes: stringList.default([]),
  safeAreas: z.string().min(1),
  resizing: z.string().min(1),
  adaptiveBehavior: z.string().min(1),
});
export type PlatformProfile = z.infer<typeof platformProfileSchema>;

export const approvedDependencySchema = z.object({
  name: z.string().min(1),
  purpose: z.string().default(""),
  source: z.enum(["user-selected", "recommended"]).default("recommended"),
  platforms: stringList.default([]),
});
export type ApprovedDependency = z.infer<typeof approvedDependencySchema>;

export const layoutSystemSchema = z.object({
  shell: z.string().default(""),
  navigation: z.string().default(""),
  grid: z.string().default(""),
  breakpoints: z.array(breakpointSchema).default([]),
});

export const uiDesignSpecSchema = z.object({
  overview: z.string().default(""),
  styleDirection: z.string().default(""),
  creativeConcept: z.string().default(""),
  creativeRationale: z.string().default(""),
  themeMode: z.string().default(""),
  principles: stringList.default([]),
  signatureMoments: z.array(signatureMomentSchema).default([]),
  fontFamilies: z.array(fontFamilySchema).default([]),
  colorTokens: z.array(designTokenSchema).default([]),
  typographyScale: z.array(typographyTokenSchema).default([]),
  spacingScale: z.array(designTokenSchema).default([]),
  radiusTokens: z.array(designTokenSchema).default([]),
  shadowTokens: z.array(designTokenSchema).default([]),
  layout: layoutSystemSchema.default({ shell: "", navigation: "", grid: "", breakpoints: [] }),
  platformProfiles: z.array(platformProfileSchema).default([]),
  approvedDependencies: z.array(approvedDependencySchema).default([]),
  components: z.array(designComponentSchema).default([]),
  screens: z.array(designScreenSchema).default([]),
  interactionRules: stringList.default([]),
  accessibilityRules: stringList.default([]),
  contentRules: stringList.default([]),
  antiPatterns: stringList.default([]),
  visualQaRules: stringList.default([]),
});
export type UiDesignSpec = z.infer<typeof uiDesignSpecSchema>;

/* ------------------------------------------------------------------ */
/* Asset plan specification                                           */
/* ------------------------------------------------------------------ */

export const assetSourcePolicySchema = z.object({
  rationale: z.string().default(""),
  freeOnly: z.boolean().default(true),
  legalOnly: z.boolean().default(true),
  localOnly: z.boolean().default(true),
});
export type AssetSourcePolicy = z.infer<typeof assetSourcePolicySchema>;

export const assetSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  officialUrl: z.string().min(1),
  assetTypes: stringList.default([]),
  license: z.string().min(1),
  attributionRequired: z.boolean().default(false),
  platformRestrictions: stringList.default([]),
});
export type AssetSource = z.infer<typeof assetSourceSchema>;

export const iconMappingSchema = z.object({
  action: z.string().min(1),
  icon: z.string().min(1),
});
export type IconMapping = z.infer<typeof iconMappingSchema>;

export const iconSystemSchema = z.object({
  platform: z.string().min(1),
  family: z.string().min(1),
  size: z.string().min(1),
  stroke: z.string().min(1),
  fill: z.string().min(1),
  opticalAlignment: z.string().min(1),
  color: z.string().min(1),
  accessibility: z.string().min(1),
  mappings: z.array(iconMappingSchema).default([]),
});
export type IconSystem = z.infer<typeof iconSystemSchema>;

export const assetEntrySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  purpose: z.string().min(1),
  screenIds: stringList.default([]),
  placement: z.string().min(1),
  sourceMethod: z.string().min(1),
  sourceId: z.string().min(1),
  query: z.string().default(""),
  destinationPath: z.string().min(1),
  format: z.string().default(""),
  dimensions: z.string().default(""),
  aspectRatio: z.string().default(""),
  treatment: z.string().default(""),
  altText: z.string().default(""),
  fallback: z.string().min(1),
  platformVariants: stringList.default([]),
  license: z.string().min(1),
  attribution: z.string().min(1),
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

export const assetPlanSpecSchema = z.object({
  strategy: z.string().min(1),
  sourcePolicy: assetSourcePolicySchema.default({
    rationale: "",
    freeOnly: true,
    legalOnly: true,
    localOnly: true,
  }),
  iconSystems: z.array(iconSystemSchema).default([]),
  sources: z.array(assetSourceSchema).default([]),
  assets: z.array(assetEntrySchema).default([]),
});
export type AssetPlanSpec = z.infer<typeof assetPlanSpecSchema>;

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
  autoFixed: z.number().default(0),
});
export type ConsistencyReport = z.infer<typeof consistencyReportSchema>;
