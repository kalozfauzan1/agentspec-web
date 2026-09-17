import { z } from "zod";
import {
  apiSpecSchema,
  architectureSpecSchema,
  ARTIFACT_KEYS,
  assetPlanSpecSchema,
  clarificationAnswerSchema,
  clarificationQuestionSchema,
  consistencyIssueSchema,
  dataModelSpecSchema,
  documentSchema,
  endpointSchema,
  featureSpecSchema,
  ideaAnalysisSchema,
  projectDefinitionSchema,
  taskSchema,
  uiDesignSpecSchema,
  userFlowSchema,
  type ArtifactKey,
  type DocSection,
  type FeatureSpec,
  type ImplementationTask,
  type ProjectDefinition,
} from "@/lib/schemas";
import { runDeterministicChecks } from "@/lib/validation/checks";
import {
  demoAgentInstructions,
  demoAnalyze,
  demoApi,
  demoArchitecture,
  demoDataModel,
  demoDefinition,
  demoFeatures,
  demoFlows,
  demoAssetPlan,
  demoPrd,
  demoTasks,
  demoUiDesign,
} from "./demo";
import {
  normalizeApi,
  normalizeArchitecture,
  normalizeAssetPlan,
  normalizeDataModel,
  normalizeDocument,
  normalizeFeatures,
  normalizeTasks,
  normalizeUiDesign,
} from "./normalize";
import { parseWithSchema } from "./parse";
import {
  EDIT_TARGETS,
  PRD_SECTION_TITLES,
  promptAgentInstructions,
  promptAnalyze,
  promptApi,
  promptArchitecture,
  promptAssetPlan,
  promptClarify,
  promptDataModel,
  promptDefinition,
  promptEdit,
  promptFeatures,
  promptFlows,
  promptPrd,
  promptTasks,
  promptUiDesign,
  promptValidate,
  buildSpecDigest,
  type EditTarget,
} from "./prompts";
import { AiError, callModel, modelForStep, type ProviderConfig } from "./provider";
import { rebaseTaskIds, taskBatchStages } from "./task-batches";

export const STEP_KEYS = [
  "analyze",
  "clarify",
  "definition",
  "prd",
  "features",
  "flows",
  "uiDesign",
  "assetPlan",
  "architecture",
  "dataModel",
  "api",
  "tasks",
  "tasksBatch",
  "agentInstructions",
  "validate",
  "edit",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const taskBatchRequestSchema = z.object({
  index: z.number().int().min(1),
  total: z.number().int().min(1),
  label: z.string().min(1),
  phases: z.array(z.string().min(1)).min(1),
  featureIds: z.array(z.string()).default([]),
  knownTasks: z.array(z.object({ id: z.string().min(1), title: z.string().default("") })).default([]),
  nextTaskNumber: z.number().int().min(1),
});
export type TaskBatchRequest = z.infer<typeof taskBatchRequestSchema>;

export const stepRequestSchema = z.object({
  mode: z.enum(["live", "demo"]).optional(),
  idea: z.string().optional(),
  analysis: ideaAnalysisSchema.nullable().optional(),
  questions: z.array(clarificationQuestionSchema).optional(),
  answers: z.array(clarificationAnswerSchema).optional(),
  definition: projectDefinitionSchema.nullable().optional(),
  features: z.array(featureSpecSchema).optional(),
  flows: z.array(userFlowSchema).optional(),
  uiDesign: uiDesignSpecSchema.nullable().optional(),
  assetPlan: assetPlanSpecSchema.nullable().optional(),
  architecture: architectureSpecSchema.nullable().optional(),
  dataModel: dataModelSpecSchema.nullable().optional(),
  api: apiSpecSchema.nullable().optional(),
  tasks: z.array(taskSchema).optional(),
  prd: documentSchema.nullable().optional(),
  agentInstructions: documentSchema.nullable().optional(),
  target: z.enum(EDIT_TARGETS).optional(),
  instruction: z.string().optional(),
  batch: taskBatchRequestSchema.optional(),
});
export type StepRequest = z.infer<typeof stepRequestSchema>;

export interface StepResult {
  step: StepKey;
  payload: unknown;
  warnings: string[];
}

const editResponseSchema = z.object({
  summary: z.string().default(""),
  affected: z.array(z.string()).default([]),
  definition: projectDefinitionSchema.optional(),
  document: documentSchema.optional(),
  features: z.array(featureSpecSchema).optional(),
  flows: z.array(userFlowSchema).optional(),
  uiDesign: uiDesignSpecSchema.optional(),
  assetPlan: assetPlanSpecSchema.optional(),
  architecture: architectureSpecSchema.optional(),
  dataModel: dataModelSpecSchema.optional(),
  api: apiSpecSchema.optional(),
  tasks: z.array(taskSchema).optional(),
});

const FIELD_TO_ARTIFACTS: Record<string, ArtifactKey[]> = {
  name: ["prd", "agentInstructions"],
  summary: ["prd", "agentInstructions"],
  platform: ["prd", "architecture", "tasks"],
  users: ["prd", "features", "flows", "tasks"],
  roles: ["prd", "features", "flows", "tasks"],
  features: [...ARTIFACT_KEYS],
  requirements: ["prd", "tasks"],
  businessRules: ["prd", "features"],
  constraints: ["prd", "architecture", "tasks"],
  nonGoals: ["prd", "features", "tasks", "agentInstructions"],
  integrations: ["architecture", "api", "tasks"],
  technicalPreferences: ["architecture", "api", "tasks", "agentInstructions"],
  visualDirection: ["uiDesign", "assetPlan", "tasks", "agentInstructions"],
  implementation: ["tasks", "agentInstructions"],
};

function requireNonEmpty<T>(items: T[], step: StepKey): T[] {
  if (items.length === 0) {
    throw new AiError(
      "empty-artifact",
      `Model tidak menghasilkan isi apa pun untuk ${step}. Coba generate ulang dokumen ini.`,
      502,
    );
  }
  return items;
}

function dedupeWarnings(warnings: string[]) {
  return Array.from(new Set(warnings));
}

/** Runs one batch of a step; a batch failure is reported instead of aborting the step. */
async function runBatch(
  label: string,
  warnings: string[],
  work: () => Promise<void>,
): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (error) {
    warnings.push(`${label}: ${error instanceof Error ? error.message : "batch gagal"}`);
    return false;
  }
}

export function computeAffectedArtifacts(
  before: z.infer<typeof projectDefinitionSchema>,
  after: z.infer<typeof projectDefinitionSchema>,
): ArtifactKey[] {
  const affected = new Set<ArtifactKey>();
  for (const [field, artifacts] of Object.entries(FIELD_TO_ARTIFACTS)) {
    const previous = JSON.stringify((before as Record<string, unknown>)[field] ?? null);
    const next = JSON.stringify((after as Record<string, unknown>)[field] ?? null);
    if (previous !== next) artifacts.forEach((artifact) => affected.add(artifact));
  }
  return ARTIFACT_KEYS.filter((key) => affected.has(key));
}

/** Never let an AI edit downgrade a decision the user made explicitly. */
export function preserveUserDecisions(
  before: z.infer<typeof projectDefinitionSchema> | null,
  after: z.infer<typeof projectDefinitionSchema>,
) {
  if (!before) return after;
  const explicit = new Map(
    before.technicalPreferences
      .filter((preference) => preference.source === "user-selected")
      .map((preference) => [preference.component.toLowerCase(), preference]),
  );

  return {
    ...after,
    technicalPreferences: after.technicalPreferences.map((preference) => {
      const previous = explicit.get(preference.component.toLowerCase());
      if (!previous) return preference;
      return {
        ...preference,
        technology: preference.technology ?? previous.technology,
        source: "user-selected" as const,
      };
    }),
  };
}

function providerFromRequest(request: StepRequest, config: ProviderConfig): ProviderConfig {
  if (request.mode === "demo") return { ...config, mode: "demo" };
  return config;
}

/**
 * Long artifacts need a much larger output budget than short ones. When the
 * provider still stops early, the repair pass asks for the same JSON in a more
 * compact form instead of failing the whole step.
 */
const STEP_MAX_TOKENS: Partial<Record<StepKey, number>> = {
  features: 24_000,
  tasks: 16_000,
  tasksBatch: 16_000,
  uiDesign: 24_000,
  assetPlan: 24_000,
  prd: 20_000,
  api: 18_000,
  dataModel: 16_000,
  agentInstructions: 16_000,
  flows: 14_000,
  architecture: 14_000,
};

const COMPACT_INSTRUCTION =
  "The previous attempt was cut off because it exceeded the output token limit. Return the COMPLETE JSON again, matching the required shape exactly. Keep every required key and every list item, but write each text field as one short sentence (at most about 15 words). Do not add commentary.";

/**
 * One step request must answer before the API route maxDuration (300s) and the
 * client-side timeout (285s). The budget is shared by the main call and the
 * repair pass: a long answer plus a repair used to overrun the request, so the
 * client aborted and threw away both responses.
 */
const STEP_BUDGET_MS = 265_000;

interface GenerateParams<T> {
  step: StepKey;
  config: ProviderConfig;
  schema: z.ZodType<T>;
  prompt: { system: string; user: string };
  demo: () => unknown;
  temperature?: number;
  warnings?: string[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches.length > 0 ? batches : [[]];
}

async function generateStep<T>(params: GenerateParams<T>): Promise<T> {
  const { step, config, schema, prompt, demo, temperature, warnings } = params;

  if (config.mode === "demo") {
    const parsed = schema.safeParse(demo());
    if (!parsed.success) {
      throw new AiError(
        "demo-invalid",
        `Generator demo menghasilkan data yang tidak valid pada step ${step}.`,
        500,
      );
    }
    return parsed.data;
  }

  const requestedModel = modelForStep(config.model, step);
  const deadline = Date.now() + STEP_BUDGET_MS;
  const noteFallback = (usedModel: string) => {
    if (!warnings || usedModel === requestedModel) return;
    const message = `Model "${requestedModel}" sedang tidak tersedia, jadi dokumen ini dibuat dengan model cadangan "${usedModel}".`;
    if (!warnings.includes(message)) warnings.push(message);
  };

  const result = await callModel(
    { ...config, model: requestedModel },
    {
      system: prompt.system,
      user: prompt.user,
      json: true,
      temperature,
      maxTokens: STEP_MAX_TOKENS[step],
      deadline,
    },
  );
  noteFallback(result.model);

  return parseWithSchema(schema, result.content, {
    step,
    truncated: result.truncated,
    repair: async ({ problem, truncated }) => {
      // The retry keeps the original instructions so the model still knows the
      // required shape; weak providers truncate long answers even when they
      // report finish_reason "stop", so compaction happens on every retry.
      const repaired = await callModel(
        { ...config, model: requestedModel },
        {
          system: `${prompt.system}\n\n${COMPACT_INSTRUCTION}`,
          user: `${prompt.user}\n\nNOTE: the previous attempt failed (${problem}). Answer again, complete and compact.`,
          json: true,
          temperature: 0,
          maxTokens: STEP_MAX_TOKENS[step] ?? 12_000,
          deadline,
        },
      );
      noteFallback(repaired.model);
      return repaired.content;
    },
  });
}

function requireDefinition(request: StepRequest) {
  if (!request.definition) {
    throw new AiError("missing-definition", "Project definition belum tersedia untuk step ini.", 400);
  }
  return request.definition;
}

function requireIdea(request: StepRequest) {
  const idea = request.idea?.trim();
  if (!idea) throw new AiError("missing-idea", "Ide proyek belum diisi.", 400);
  return idea;
}

export async function runStep(
  step: StepKey,
  request: StepRequest,
  baseConfig: ProviderConfig,
): Promise<StepResult> {
  const config = providerFromRequest(request, baseConfig);
  const warnings: string[] = [];
  // Every provider call belongs to this step's warnings, so a model fallback is
  // reported to the user instead of happening silently.
  const generate = <T,>(params: Omit<GenerateParams<T>, "warnings">) =>
    generateStep({ ...params, warnings });

  switch (step) {
    case "analyze": {
      const idea = requireIdea(request);
      const analysis = await generate({
        step,
        config,
        schema: ideaAnalysisSchema,
        prompt: promptAnalyze(idea),
        demo: () => demoAnalyze(idea),
        temperature: 0.2,
      });
      return { step, payload: { analysis }, warnings };
    }

    case "clarify": {
      const idea = requireIdea(request);
      const analysis = request.analysis;
      if (!analysis) throw new AiError("missing-analysis", "Analisis ide belum tersedia.", 400);
      const result = await generate({
        step,
        config,
        schema: z.object({ questions: z.array(clarificationQuestionSchema).default([]) }),
        prompt: promptClarify(idea, analysis),
        demo: () => ({
          questions: buildDemoQuestions(analysis),
        }),
        temperature: 0.4,
      });
      return { step, payload: { questions: result.questions }, warnings };
    }

    case "definition": {
      const idea = requireIdea(request);
      const analysis = request.analysis;
      if (!analysis) throw new AiError("missing-analysis", "Analisis ide belum tersedia.", 400);
      const questions = request.questions ?? [];
      const answers = request.answers ?? [];
      const definition = await generate({
        step,
        config,
        schema: projectDefinitionSchema,
        prompt: promptDefinition(
          idea,
          analysis,
          questions.map((question) => ({
            id: question.id,
            question: question.question,
            type: question.type,
            options: question.options,
          })),
          answers,
        ),
        demo: () => demoDefinition(idea, analysis, questions, answers),
        temperature: 0.2,
      });
      return { step, payload: { definition }, warnings };
    }

    case "prd": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];

      // Demo mode is deterministic and cheap, so it runs in a single pass.
      if (config.mode === "demo") {
        const prd = await generate({
          step,
          config,
          schema: documentSchema,
          prompt: promptPrd(definition, features),
          demo: () => demoPrd(definition, features),
          temperature: 0.4,
        });
        const document = normalizeDocument(prd, `Product Requirements Document — ${definition.name}`);
        const emptySections = document.sections.filter((section) => section.blocks.length === 0);
        if (emptySections.length > 0) {
          warnings.push(
            `PRD: ${emptySections.length} section kosong (${emptySections.map((section) => section.title).join(", ")}).`,
          );
        }
        return { step, payload: { prd: document }, warnings };
      }

      // Two halves keep every answer inside the provider's output budget.
      const halves = [
        PRD_SECTION_TITLES.slice(0, 7),
        PRD_SECTION_TITLES.slice(7),
      ];
      const sections: DocSection[] = [];
      let title = "";
      let summary = "";

      for (const [index, titles] of halves.entries()) {
        await runBatch(`PRD part ${index + 1}/${halves.length}`, warnings, async () => {
          const part = await generate({
            step,
            config,
            schema: documentSchema,
            prompt: promptPrd(definition, features, {
              index: index + 1,
              total: halves.length,
              sectionTitles: [...titles],
            }),
            demo: () => demoPrd(definition, features),
            temperature: 0.4,
          });
          if (!title) title = part.title;
          if (!summary) summary = part.summary;
          sections.push(...part.sections);
        });
      }

      const document = normalizeDocument(
        { title, summary, sections },
        `Product Requirements Document — ${definition.name}`,
      );
      const missingSections = PRD_SECTION_TITLES.filter(
        (expected) =>
          !document.sections.some((section) => section.title.toLowerCase() === expected.toLowerCase()),
      );
      if (missingSections.length > 0) {
        warnings.push(`PRD kehilangan section: ${missingSections.join(", ")}.`);
      }
      return { step, payload: { prd: document }, warnings };
    }

    case "features": {
      const definition = requireDefinition(request);

      // Demo mode is deterministic and cheap, so it runs in a single pass.
      if (config.mode === "demo") {
        const result = await generate({
          step,
          config,
          schema: z.object({ features: z.array(featureSpecSchema).default([]) }),
          prompt: promptFeatures(definition),
          demo: () => ({ features: demoFeatures(definition) }),
          temperature: 0.4,
        });
        const features = normalizeFeatures(result.features, definition);
        if (features.length === 0) warnings.push("Feature specifications kosong.");
        return { step, payload: { features }, warnings };
      }

      const groups = chunk(definition.features, 4);
      const collected: FeatureSpec[] = [];
      for (const [index, subset] of groups.entries()) {
        await runBatch(`Feature batch ${index + 1}/${groups.length}`, warnings, async () => {
          const result = await generate({
            step,
            config,
            schema: z.object({ features: z.array(featureSpecSchema).default([]) }),
            prompt: promptFeatures(definition, {
              index: index + 1,
              total: groups.length,
              subset,
            }),
            demo: () => ({ features: demoFeatures(definition) }),
            temperature: 0.4,
          });
          collected.push(...result.features);
        });
      }

      const features = requireNonEmpty(normalizeFeatures(collected, definition), "features");
      if (features.length < definition.features.length) {
        warnings.push(
          `Hanya ${features.length} dari ${definition.features.length} fitur yang berhasil dibuat.`,
        );
      }
      return { step, payload: { features }, warnings: dedupeWarnings(warnings) };
    }

    case "flows": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const result = await generate({
        step,
        config,
        schema: z.object({ flows: z.array(userFlowSchema).default([]) }),
        prompt: promptFlows(definition, features),
        demo: () => ({ flows: demoFlows(definition, features) }),
        temperature: 0.4,
      });
      return { step, payload: { flows: result.flows }, warnings };
    }

    case "uiDesign": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const architecture = request.architecture ?? null;
      const design = await generate({
        step,
        config,
        schema: uiDesignSpecSchema,
        prompt: promptUiDesign(definition, features, architecture),
        demo: () => demoUiDesign(definition, features),
        temperature: 0.45,
      });
      const normalized = normalizeUiDesign(design, features);
      requireNonEmpty(normalized.screens, "uiDesign");
      requireNonEmpty(normalized.components, "uiDesign");
      if (normalized.colorTokens.length === 0) {
        warnings.push("UI design belum memuat color token, jadi coding agent akan memilih warnanya sendiri.");
      }
      const coveredFeatures = new Set(normalized.screens.map((screen) => screen.featureId));
      const missing = features.filter((feature) => !coveredFeatures.has(feature.id));
      if (missing.length > 0) {
        warnings.push(
          `Belum ada layar untuk fitur: ${missing.map((feature) => feature.name).join(", ")}.`,
        );
      }
      return { step, payload: { uiDesign: normalized }, warnings };
    }

    case "assetPlan": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const architecture = request.architecture ?? null;
      const uiDesign = request.uiDesign ?? null;
      const plan = await generate({
        step,
        config,
        schema: assetPlanSpecSchema,
        prompt: promptAssetPlan(definition, features, architecture, uiDesign),
        demo: () => demoAssetPlan(definition, features, uiDesign ?? demoUiDesign(definition, features)),
        temperature: 0.35,
      });
      const normalized = normalizeAssetPlan(plan, uiDesign);
      requireNonEmpty(normalized.iconSystems, "assetPlan");
      requireNonEmpty(normalized.sources, "assetPlan");
      if (normalized.assets.length === 0) {
        warnings.push("Asset plan belum memuat aset media apa pun.");
      }
      if (!normalized.sourcePolicy.freeOnly || !normalized.sourcePolicy.legalOnly) {
        warnings.push("Kebijakan sumber aset tidak mewajibkan aset gratis dan legal.");
      }
      const unknownScreens = normalized.assets.filter((asset) => asset.screenIds.every((id) => typeof id !== "string" || id.length === 0));
      if (unknownScreens.length > 0) {
        warnings.push(
          `Aset tanpa layar yang valid: ${unknownScreens.map((asset) => asset.id).join(", ")}.`,
        );
      }
      return { step, payload: { assetPlan: normalized }, warnings };
    }

    case "architecture": {
      const definition = requireDefinition(request);
      const architecture = await generate({
        step,
        config,
        schema: architectureSpecSchema,
        prompt: promptArchitecture(definition),
        demo: () => demoArchitecture(definition),
        temperature: 0.3,
      });
      return {
        step,
        payload: { architecture: normalizeArchitecture(architecture) },
        warnings,
      };
    }

    case "dataModel": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const dataModel = await generate({
        step,
        config,
        schema: dataModelSpecSchema,
        prompt: promptDataModel(definition, features),
        demo: () => demoDataModel(definition, features),
        temperature: 0.3,
      });
      const normalized = normalizeDataModel(dataModel);
      requireNonEmpty(normalized.entities, "dataModel");
      return { step, payload: { dataModel: normalized }, warnings };
    }

    case "api": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const dataModel = request.dataModel ?? null;
      const architecture = request.architecture ?? null;

      // Demo mode is deterministic and cheap, so it runs in a single pass.
      if (config.mode === "demo") {
        const api = await generate({
          step,
          config,
          schema: apiSpecSchema,
          prompt: promptApi(definition, features, dataModel, architecture),
          demo: () => demoApi(definition, features, dataModel),
          temperature: 0.3,
        });
        return { step, payload: { api: normalizeApi(api, features) }, warnings };
      }

      const groups = chunk(features, 4);
      const batches: { label: string; focus: FeatureSpec[] }[] = [
        ...groups.map((group, index) => ({
          label: `feature endpoints (part ${index + 1} of ${groups.length})`,
          focus: group,
        })),
        { label: "cross-cutting endpoints", focus: [] },
      ];

      const endpoints: z.infer<typeof endpointSchema>[] = [];
      let overview = "";
      let authentication = "";

      for (const [index, batch] of batches.entries()) {
        await runBatch(`API ${batch.label}`, warnings, async () => {
          const result = await generate({
            step,
            config,
            schema: apiSpecSchema,
            prompt: promptApi(definition, features, dataModel, architecture, {
              index: index + 1,
              total: batches.length,
              label: batch.label,
              focus: batch.focus,
            }),
            demo: () => demoApi(definition, features, dataModel),
            temperature: 0.3,
          });
          if (!overview) overview = result.overview;
          if (!authentication) authentication = result.authentication;
          endpoints.push(...result.endpoints);
        });
      }

      const api = normalizeApi({ overview, authentication, endpoints }, features);
      if (api.endpoints.length === 0) warnings.push("Belum ada endpoint yang dihasilkan.");
      return { step, payload: { api }, warnings };
    }

    case "tasks": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const architecture = request.architecture ?? null;
      const uiDesign = request.uiDesign ?? null;
      const assetPlan = request.assetPlan ?? null;
      const dataModel = request.dataModel ?? null;
      const api = request.api ?? null;
      const taskSchemaShape = z.object({ tasks: z.array(taskSchema).default([]) });

      let collected: ImplementationTask[] = [];

      if (config.mode === "demo") {
        const result = await generate({
          step,
          config,
          schema: taskSchemaShape,
          prompt: promptTasks(definition, features, architecture, undefined, uiDesign, assetPlan, dataModel, api),
          demo: () => ({ tasks: demoTasks(definition, features, architecture, uiDesign, assetPlan) }),
          temperature: 0.4,
        });
        collected = result.tasks;
      } else {
        const stages = taskBatchStages(definition, features);
        const total = stages.flat().length;
        let completedBatches = 0;

        for (const stage of stages) {
          const knownTasks = collected.map((task) => ({ id: task.id, title: task.title }));
          // Bounded concurrency (2): unbounded Promise.all over up to 6
          // batches overloads the provider → slow responses → 504 cascade.
          // Limit 2 keeps independent batches overlapping (see test) while
          // capping provider pressure.
          const results: ImplementationTask[][] = new Array(stage.length).fill([]);
          const runOne = async (batchIndex: number) => {
            const batch = stage[batchIndex];
            let generated: ImplementationTask[] = [];
            await runBatch(`Task ${batch.label}`, warnings, async () => {
              const result = await generate({
                step,
                config,
                schema: taskSchemaShape,
                prompt: promptTasks(
                  definition,
                  batch.features.length > 0 ? batch.features : features,
                  architecture,
                  {
                    index: completedBatches + batchIndex + 1,
                    total,
                    label: batch.label,
                    phases: batch.phases,
                    features: batch.features.map((feature) => ({ id: feature.id })),
                    knownTasks,
                    nextTaskNumber: knownTasks.length + 1,
                  },
                  uiDesign,
                  assetPlan,
                  dataModel,
                  api,
                ),
                demo: () => ({ tasks: [] }),
                temperature: 0.4,
              });
              generated = result.tasks;
              if (result.tasks.length === 0) {
                warnings.push(`Batch task "${batch.label}" tidak menghasilkan task apa pun.`);
              }
            });
            results[batchIndex] = generated;
          };
          const workers: Promise<void>[] = [];
          let next = 0;
          const workerCount = Math.min(2, stage.length);
          for (let w = 0; w < workerCount; w += 1) {
            workers.push(
              (async () => {
                while (next < stage.length) {
                  const current = next;
                  next += 1;
                  await runOne(current);
                }
              })(),
            );
          }
          await Promise.all(workers);

          for (const tasks of results) {
            const rebased = rebaseTaskIds(tasks, collected.length + 1);
            collected.push(...rebased);
          }
          completedBatches += stage.length;
        }
      }

      const tasks = requireNonEmpty(normalizeTasks(collected, features, definition), "tasks");
      for (const task of tasks) {
        if (task.references.length === 0 && task.featureId) {
          warnings.push(`${task.id} tidak punya rujukan requirement.`);
        }
      }
      return { step, payload: { tasks }, warnings: dedupeWarnings(warnings).slice(0, 5) };
    }

    case "tasksBatch": {
      const definition = requireDefinition(request);
      const features = request.features ?? [];
      const batch = request.batch;
      if (!batch) throw new AiError("missing-batch", "Batch task belum ditentukan.", 400);
      const architecture = request.architecture ?? null;
      const uiDesign = request.uiDesign ?? null;
      const assetPlan = request.assetPlan ?? null;
      const dataModel = request.dataModel ?? null;
      const api = request.api ?? null;
      const taskSchemaShape = z.object({ tasks: z.array(taskSchema).default([]) });

      // Resolve and validate the batch scope: one request generates exactly
      // one batch, so a 504 can only ever lose this batch — never the plan.
      const knownFeatureIds = new Set(features.map((feature) => feature.id));
      const unknown = batch.featureIds.filter((id) => id && !knownFeatureIds.has(id));
      if (unknown.length > 0) {
        throw new AiError(
          "invalid-batch",
          `Batch merujuk feature yang tidak ada: ${unknown.join(", ")}.`,
          400,
        );
      }
      const batchFeatures =
        batch.featureIds.length > 0
          ? features.filter((feature) => batch.featureIds.includes(feature.id))
          : [];

      const result = await generate({
        step,
        config,
        schema: taskSchemaShape,
        prompt: promptTasks(
          definition,
          batchFeatures.length > 0 ? batchFeatures : features,
          architecture,
          {
            index: batch.index,
            total: batch.total,
            label: batch.label,
            phases: batch.phases,
            features: batchFeatures.map((feature) => ({ id: feature.id })),
            knownTasks: batch.knownTasks,
            nextTaskNumber: batch.nextTaskNumber,
          },
          uiDesign,
          assetPlan,
          dataModel,
          api,
        ),
        demo: () => ({ tasks: [] }),
        temperature: 0.4,
      });
      if (result.tasks.length === 0) {
        warnings.push(`Batch task "${batch.label}" tidak menghasilkan task apa pun.`);
      }
      // Raw tasks: id rebasing and cross-batch normalization happen once on
      // the client after every batch lands, keeping ids globally consistent.
      return { step, payload: { tasks: result.tasks }, warnings };
    }

    case "agentInstructions": {
      const definition = requireDefinition(request);
      const tasks = request.tasks ?? [];
      const architecture = request.architecture ?? null;
      const uiDesign = request.uiDesign ?? null;
      const assetPlan = request.assetPlan ?? null;
      const document = await generate({
        step,
        config,
        schema: documentSchema,
        prompt: promptAgentInstructions(definition, tasks, architecture, uiDesign, assetPlan),
        demo: () => demoAgentInstructions(definition, tasks, architecture, uiDesign, assetPlan),
        temperature: 0.3,
      });
      return {
        step,
        payload: { agentInstructions: normalizeDocument(document, "AGENTS.md") },
        warnings,
      };
    }

    case "validate": {
      const input = {
        definition: request.definition ?? null,
        features: request.features ?? [],
        flows: request.flows ?? [],
        uiDesign: request.uiDesign ?? null,
        assetPlan: request.assetPlan ?? null,
        architecture: request.architecture ?? null,
        dataModel: request.dataModel ?? null,
        api: request.api ?? null,
        tasks: request.tasks ?? [],
        prd: request.prd ?? null,
        agentInstructions: request.agentInstructions ?? null,
      };
      const deterministic = runDeterministicChecks(input);
      const digest = buildSpecDigest(input);

      let aiIssues: z.infer<typeof consistencyIssueSchema>[] = [];
      try {
        const result = await generate({
          step,
          config,
          schema: z.object({ issues: z.array(consistencyIssueSchema).default([]) }),
          prompt: promptValidate(digest),
          demo: () => ({ issues: [] }),
          temperature: 0.2,
        });
        aiIssues = result.issues;
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Validasi AI dilewati: ${error.message}`
            : "Validasi AI dilewati.",
        );
      }

      const merged = dedupeIssues([...deterministic, ...aiIssues]);
      return { step, payload: { issues: merged }, warnings };
    }

    case "edit": {
      const target = request.target;
      const instruction = request.instruction?.trim();
      if (!target) throw new AiError("missing-target", "Target edit belum ditentukan.", 400);
      if (!instruction) throw new AiError("missing-instruction", "Instruksi edit masih kosong.", 400);

      const definition = request.definition ?? null;
      const payload = payloadForTarget(target, request);

      const result = await generate({
        step,
        config,
        schema: editResponseSchema,
        prompt: promptEdit({ target, instruction, definition, payload }),
        demo: () => demoEdit(target, instruction, request),
        temperature: 0.3,
      });

      return { step, payload: buildEditPatch(target, result, request), warnings };
    }

    default: {
      throw new AiError("unknown-step", `Step "${step}" tidak dikenal.`, 404);
    }
  }
}

function payloadForTarget(target: EditTarget, request: StepRequest) {
  switch (target) {
    case "definition":
      return request.definition ?? null;
    case "prd":
      return request.prd ?? null;
    case "features":
      return request.features ?? [];
    case "flows":
      return request.flows ?? [];
    case "uiDesign":
      return request.uiDesign ?? null;
    case "assetPlan":
      return request.assetPlan ?? null;
    case "architecture":
      return request.architecture ?? null;
    case "dataModel":
      return request.dataModel ?? null;
    case "api":
      return request.api ?? null;
    case "tasks":
      return request.tasks ?? [];
    case "agentInstructions":
      return request.agentInstructions ?? null;
  }
}

function buildEditPatch(
  target: EditTarget,
  result: z.infer<typeof editResponseSchema>,
  request: StepRequest,
) {
  const summary = result.summary?.trim() || "Perubahan diterapkan.";
  const patch: Record<string, unknown> = {};
  const affected: ArtifactKey[] = [];

  if (target === "definition" && result.definition) {
    const preserved = preserveUserDecisions(request.definition ?? null, result.definition);
    const computed = computeAffectedArtifacts(
      request.definition ?? preserved,
      preserved,
    );
    patch.definition = preserved;
    affected.push(...computed);
  }

  if (target === "prd" && result.document) {
    patch.prd = normalizeDocument(result.document, "Product Requirements Document");
  }
  if (target === "agentInstructions" && result.document) {
    patch.agentInstructions = normalizeDocument(result.document, "AGENTS.md");
  }
  if (target === "features" && result.features) {
    patch.features = normalizeFeatures(result.features, request.definition ?? null);
  }
  if (target === "flows" && result.flows) {
    patch.flows = result.flows;
  }
  if (target === "uiDesign" && result.uiDesign) {
    patch.uiDesign = normalizeUiDesign(result.uiDesign, request.features ?? []);
  }
  if (target === "assetPlan" && result.assetPlan) {
    patch.assetPlan = normalizeAssetPlan(result.assetPlan, request.uiDesign ?? null);
  }
  if (target === "architecture" && result.architecture) {
    patch.architecture = normalizeArchitecture(result.architecture);
  }
  if (target === "dataModel" && result.dataModel) {
    patch.dataModel = normalizeDataModel(result.dataModel);
  }
  if (target === "api" && result.api) {
    patch.api = normalizeApi(result.api, request.features ?? []);
  }
  if (target === "tasks" && result.tasks) {
    patch.tasks = normalizeTasks(result.tasks, request.features ?? [], request.definition ?? null);
  }

  // A features edit can invalidate task references, so tasks follow along.
  if (target === "features" && !affected.includes("tasks")) affected.push("tasks");

  return { summary, affected: ARTIFACT_KEYS.filter((key) => affected.includes(key)), patch };
}

function dedupeIssues(
  issues: z.infer<typeof consistencyIssueSchema>[],
): z.infer<typeof consistencyIssueSchema>[] {
  const seen = new Set<string>();
  const result: z.infer<typeof consistencyIssueSchema>[] = [];
  for (const issue of issues) {
    const key = issue.summary.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...issue, id: `issue-${result.length + 1}` });
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  return result.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function buildDemoQuestions(analysis: z.infer<typeof ideaAnalysisSchema>) {
  const featureNames = analysis.coreFeatures.slice(0, 2).map((feature) => feature.name).join(", ");
  const questions: z.infer<typeof clarificationQuestionSchema>[] = [
    {
      id: "primary-platform",
      question: "Platform mana yang harus selesai lebih dulu?",
      description: "Menentukan urutan pekerjaan frontend dan cara pengujiannya.",
      why: "Platform pertama menentukan struktur navigasi dan cara menguji aplikasi.",
      type: "radio",
      category: "platform",
      options: [
        { label: "Web dulu, mobile menyusul", description: "Frontend web selesai dan bisa direview lebih cepat." },
        { label: "Mobile dulu (Android/iOS)", description: "Butuh distribusi aplikasi dan pengujian perangkat." },
        { label: "Web dan mobile bersamaan", description: "Konsisten, tetapi waktu pengerjaan lebih panjang." },
      ],
    },
    {
      id: "roles-permissions",
      question: "Siapa saja yang boleh mengubah data?",
      description: "Menentukan pembagian akses antara pengguna biasa dan pengelola.",
      why: "Aturan akses masuk ke business rules dan menentukan bentuk API.",
      type: "radio",
      category: "roles-permissions",
      options: [
        { label: "Hanya administrator", description: "Semua perubahan data lewat pengelola." },
        { label: "Pengguna boleh mengubah data miliknya sendiri", description: "Perlu validasi kepemilikan data di backend." },
        { label: "Belum diputuskan", description: "Akan ditandai Undecided pada architecture." },
      ],
    },
    {
      id: "feature-scope",
      question: `Apakah cakupan fitur (${featureNames || "fitur utama"}) sudah final?`,
      description: "Menentukan isi PRD dan daftar task.",
      why: "Cakupan menentukan jumlah task dan dokumen yang harus dibuat.",
      type: "checkbox",
      category: "feature-behavior",
      options: [
        { label: "Ya, sesuai daftar sekarang", description: "Cakupan dipakai apa adanya." },
        { label: "Ada fitur yang perlu ditambah", description: "Sebutkan lewat kolom jawaban custom." },
        { label: "Ada fitur yang perlu dikurangi", description: "Sebutkan yang dibuang lewat kolom custom." },
      ],
    },
    {
      id: "external-integrations",
      question: "Apakah ada layanan eksternal yang wajib dipakai?",
      description: "Menentukan bagian integration pada arsitektur.",
      why: "Integrasi pihak ketiga menambah pekerjaan backend dan konfigurasi.",
      type: "radio",
      category: "integrations",
      options: [
        { label: "Belum ada, pakai rekomendasi dulu", description: "Ditandai Recommended pada architecture." },
        { label: "Ada, saya sebutkan di jawaban custom", description: "Provider akan ditandai User Selected." },
        { label: "Tidak perlu integrasi apa pun", description: "Semua berjalan di dalam aplikasi." },
      ],
    },
    {
      id: "visual-direction",
      question: "Seperti apa tampilan aplikasi yang kamu inginkan?",
      description: "Menentukan gaya visual, warna, dan kepadatan antarmuka yang akan diikuti coding agent.",
      why: "Tanpa arah visual, coding agent memakai tampilan default yang terlihat generik.",
      type: "radio",
      category: "visual-design",
      options: [
        {
          label: "Minimalis, bersih, satu warna aksen",
          description: "Mirip alat bantu developer modern: banyak ruang kosong, hierarki jelas.",
        },
        {
          label: "Padat data, seperti dashboard admin",
          description: "Tabel dan ringkasan informasi rapat, cocok untuk operator yang bekerja sepanjang hari.",
        },
        {
          label: "Ramah dan berwarna untuk konsumen",
          description: "Sudut membulat, warna hangat, ilustrasi pada keadaan kosong.",
        },
        {
          label: "Premium dan editorial",
          description: "Ruang lega, tipografi besar, aksen tunggal yang kuat.",
        },
      ],
    },
    {
      id: "data-retention",
      question: "Berapa lama data operasional perlu disimpan?",
      description: "Menentukan strategi penyimpanan dan kebijakan arsip.",
      why: "Kebijakan penyimpanan memengaruhi desain data dan laporan.",
      type: "radio",
      category: "data",
      options: [
        { label: "Simpan semuanya (default)", description: "Paling sederhana untuk MVP." },
        { label: "Hanya periode berjalan", description: "Butuh proses arsip atau penghapusan." },
      ],
    },
  ];
  return questions;
}

function demoEdit(target: EditTarget, instruction: string, request: StepRequest) {
  const summary = `Mode Demo: instruksi "${instruction.slice(0, 80)}" dicatat, tetapi konten tidak diubah karena tidak ada model yang aktif. Aktifkan provider AI di Settings untuk mengubah isi spesifikasi secara nyata.`;

  if (target === "definition" && request.definition) {
    return { summary, affected: [], definition: request.definition };
  }
  if (target === "prd" && request.prd) return { summary, affected: [], document: request.prd };
  if (target === "agentInstructions" && request.agentInstructions) {
    return { summary, affected: [], document: request.agentInstructions };
  }
  if (target === "features") return { summary, affected: [], features: request.features ?? [] };
  if (target === "flows") return { summary, affected: [], flows: request.flows ?? [] };
  if (target === "uiDesign") return { summary, affected: [], uiDesign: request.uiDesign ?? undefined };
  if (target === "assetPlan") return { summary, affected: [], assetPlan: request.assetPlan ?? undefined };
  if (target === "architecture") return { summary, affected: [], architecture: request.architecture ?? undefined };
  if (target === "dataModel") return { summary, affected: [], dataModel: request.dataModel ?? undefined };
  if (target === "api") return { summary, affected: [], api: request.api ?? undefined };
  if (target === "tasks") return { summary, affected: [], tasks: request.tasks ?? [] };
  return { summary, affected: [] };
}