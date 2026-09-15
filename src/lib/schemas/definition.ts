import { z } from "zod";

/**
 * Structured models for everything the AI produces.
 * Documents are always presented/exported as Markdown, but the application state
 * that drives the UI lives here (PRD §10, §34).
 */

export const implementationStrategySchema = z.enum(["frontend-first", "module-first"]);
export type ImplementationStrategy = z.infer<typeof implementationStrategySchema>;

export const decisionSourceSchema = z.enum(["user-selected", "recommended", "undecided"]);
export type DecisionSource = z.infer<typeof decisionSourceSchema>;

export const DECISION_SOURCE_LABEL: Record<DecisionSource, string> = {
  "user-selected": "User Selected",
  recommended: "Recommended",
  undecided: "Undecided",
};

export const techDecisionSchema = z.object({
  component: z.string().min(1),
  technology: z.string().nullable().default(null),
  source: decisionSourceSchema,
  rationale: z.string().default(""),
  alternatives: z.array(z.string()).default([]),
});
export type TechDecision = z.infer<typeof techDecisionSchema>;

export const stringList = z.preprocess((value) => {
  if (typeof value === "string") return [value];
  return value;
}, z.array(z.string().min(1)));

/* ------------------------------------------------------------------ */
/* Visual direction (PRD §9, §10)                                     */
/* ------------------------------------------------------------------ */

export const visualDirectionSchema = z.object({
  style: z.string().default(""),
  themeMode: z.string().default(""),
  references: stringList.default([]),
  notes: z.string().default(""),
  personality: z.string().default(""),
  audienceContext: z.string().default(""),
  desiredEmotion: z.string().default(""),
  informationDensity: z.string().default(""),
  mediaPreferences: stringList.default([]),
  brandConstraints: stringList.default([]),
  avoidPatterns: stringList.default([]),
});
export type VisualDirection = z.infer<typeof visualDirectionSchema>;

export const EMPTY_VISUAL_DIRECTION: VisualDirection = {
  style: "",
  themeMode: "",
  references: [],
  notes: "",
  personality: "",
  audienceContext: "",
  desiredEmotion: "",
  informationDensity: "",
  mediaPreferences: [],
  brandConstraints: [],
  avoidPatterns: [],
};

export const roleSchema = z.preprocess(
  (value) => (typeof value === "string" ? { name: value } : value),
  z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    responsibilities: stringList.default([]),
  }),
);
export type Role = z.infer<typeof roleSchema>;

export const featureOutlineSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") return { name: value };
    if (value && typeof value === "object" && !("name" in value) && "feature" in value) {
      return { ...(value as Record<string, unknown>), name: (value as Record<string, unknown>).feature };
    }
    return value;
  },
  z.object({
    name: z.string().min(1),
    description: z.string().default(""),
  }),
);
export type FeatureOutline = z.infer<typeof featureOutlineSchema>;

/* ------------------------------------------------------------------ */
/* Idea analysis (PRD §8)                                             */
/* ------------------------------------------------------------------ */

export const ideaAnalysisSchema = z.object({
  suggestedName: z.string().min(1),
  summary: z.string().min(1),
  productType: z.string().default(""),
  purpose: z.string().default(""),
  platform: stringList.default([]),
  targetUsers: stringList.default([]),
  roles: z.array(roleSchema).default([]),
  coreFeatures: z.array(featureOutlineSchema).default([]),
  businessRules: stringList.default([]),
  integrations: stringList.default([]),
  technicalPreferences: z.array(techDecisionSchema).default([]),
  visualPreferences: stringList.default([]),
  constraints: stringList.default([]),
  nonGoals: stringList.default([]),
  ambiguities: stringList.default([]),
});
export type IdeaAnalysis = z.infer<typeof ideaAnalysisSchema>;

/* ------------------------------------------------------------------ */
/* Dynamic clarification (PRD §9)                                     */
/* ------------------------------------------------------------------ */

export const clarificationQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  description: z.string().default(""),
  why: z.string().default(""),
  type: z.enum(["radio", "checkbox", "text"]).default("radio"),
  category: z
    .enum([
      "users",
      "roles-permissions",
      "business-flow",
      "feature-behavior",
      "platform",
      "integrations",
      "payment",
      "data",
      "technical",
      "visual-design",
    ])
    .default("feature-behavior"),
  options: z
    .array(
      z.preprocess(
        (value) => (typeof value === "string" ? { label: value } : value),
        z.object({ label: z.string().min(1), description: z.string().default("") }),
      ),
    )
    .default([]),
});
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;

export const clarificationAnswerSchema = z.object({
  questionId: z.string().min(1),
  values: z.array(z.string()).default([]),
  custom: z.string().default(""),
});
export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

/* ------------------------------------------------------------------ */
/* Project definition — the source of truth (PRD §10)                  */
/* ------------------------------------------------------------------ */

export const projectDefinitionSchema = z.object({
  name: z.string().min(1),
  summary: z.string().min(1),
  platform: stringList.default([]),
  users: stringList.default([]),
  roles: z.array(roleSchema).default([]),
  features: z.array(featureOutlineSchema).default([]),
  requirements: stringList.default([]),
  businessRules: stringList.default([]),
  constraints: stringList.default([]),
  nonGoals: stringList.default([]),
  integrations: stringList.default([]),
  technicalPreferences: z.array(techDecisionSchema).default([]),
  visualDirection: visualDirectionSchema.default(EMPTY_VISUAL_DIRECTION),
  implementation: z
    .object({ strategy: implementationStrategySchema.default("frontend-first") })
    .default({ strategy: "frontend-first" }),
});
export type ProjectDefinition = z.infer<typeof projectDefinitionSchema>;

export const IMPLEMENTATION_STRATEGY_LABEL: Record<ImplementationStrategy, string> = {
  "frontend-first": "Frontend First",
  "module-first": "Module First",
};
