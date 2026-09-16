"use client";

import { create } from "zustand";
import {
  ARTIFACT_KEYS,
  type ArtifactKey,
  type ArtifactStatus,
  type ClarificationAnswer,
  type ProjectRecord,
  type ProviderSettings,
} from "@/lib/schemas";
import {
  createEmptyArtifactStatus,
  deleteProject as deleteProjectRecord,
  getProject,
  listProjects,
  parseProjectFile,
  saveProject,
} from "@/lib/db/projects";
import { callStep, generateArtifacts, runValidationStep, type PipelineStage } from "@/lib/pipeline/run";
import { useSettingsStore } from "./settings-store";
import { createId } from "@/lib/utils";
import { buildRepairInstruction, isBlockingIssue, planRepairs } from "@/lib/validation/issues";

interface ProgressState {
  label: string;
  value: number;
}

interface ProjectStoreState {
  projects: ProjectRecord[];
  active: ProjectRecord | null;
  hydrated: boolean;
  busy: boolean;
  busyStage: PipelineStage | null;
  progress: ProgressState | null;
  error: { message: string; code?: string } | null;
  warnings: string[];

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  openProject: (id: string) => Promise<ProjectRecord | null>;
  createProject: (idea: string) => Promise<ProjectRecord>;
  patchProject: (updater: (project: ProjectRecord) => ProjectRecord) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  importProject: (json: string) => Promise<ProjectRecord>;

  analyzeIdea: (id: string) => Promise<void>;
  generateQuestions: (id: string) => Promise<void>;
  answerQuestion: (id: string, questionId: string, answer: ClarificationAnswer) => Promise<void>;
  buildDefinition: (id: string) => Promise<void>;

  generateSpecification: (id: string) => Promise<void>;
  regenerateArtifacts: (id: string, keys: ArtifactKey[]) => Promise<void>;
  validatePackage: (id: string) => Promise<void>;
  autoFixIssues: (id: string) => Promise<number>;
  applyInstruction: (
    id: string,
    target: ArtifactKey | "definition",
    instruction: string,
  ) => Promise<void>;

  setError: (error: { message: string; code?: string } | null) => void;
  clearWarnings: () => void;
}

function provider(): ProviderSettings {
  return useSettingsStore.getState().settings.provider;
}

const AUTO_FIX_ROUNDS = 3;

interface EditStepResult {
  summary?: string;
  affected?: ArtifactKey[];
  patch?: Partial<ProjectRecord["artifacts"]> & { definition?: ProjectRecord["definition"] };
  warnings?: string[];
}

function editBody(project: ProjectRecord, target: ArtifactKey | "definition", instruction: string) {
  return {
    target,
    instruction,
    definition: project.definition,
    prd: project.artifacts.prd,
    features: project.artifacts.features,
    flows: project.artifacts.flows,
    uiDesign: project.artifacts.uiDesign,
    assetPlan: project.artifacts.assetPlan,
    architecture: project.artifacts.architecture,
    dataModel: project.artifacts.dataModel,
    api: project.artifacts.api,
    tasks: project.artifacts.tasks,
    agentInstructions: project.artifacts.agentInstructions,
  };
}

function applyEditPatch(
  project: ProjectRecord,
  patch: NonNullable<EditStepResult["patch"]>,
  affected: ArtifactKey[],
): ProjectRecord {
  const { definition, ...artifactPatch } = patch;
  const artifactStatus = { ...project.artifactStatus };

  for (const key of ARTIFACT_KEYS) {
    if (!(key in artifactPatch)) continue;
    artifactStatus[key] = { status: "ready", error: null, warnings: [], updatedAt: Date.now() };
  }
  for (const key of affected) {
    artifactStatus[key] = {
      status: "stale",
      error: null,
      warnings: [],
      updatedAt: artifactStatus[key]?.updatedAt ?? null,
    };
  }

  return {
    ...project,
    definition: definition ?? project.definition,
    artifacts: { ...project.artifacts, ...artifactPatch },
    artifactStatus,
  };
}

function statusPatch(
  project: ProjectRecord,
  key: PipelineStage,
  update: Partial<ArtifactStatus>,
): ProjectRecord["artifactStatus"] {
  if (!(ARTIFACT_KEYS as readonly string[]).includes(key)) return project.artifactStatus;
  const artifactKey = key as ArtifactKey;
  return {
    ...project.artifactStatus,
    [artifactKey]: {
      status: update.status ?? project.artifactStatus[artifactKey]?.status ?? "empty",
      error: update.error ?? null,
      warnings: update.warnings ?? [],
      updatedAt: update.updatedAt ?? project.artifactStatus[artifactKey]?.updatedAt ?? null,
    },
  };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  active: null,
  hydrated: false,
  busy: false,
  busyStage: null,
  progress: null,
  error: null,
  warnings: [],

  hydrate: async () => {
    const projects = await listProjects();
    set({ projects, hydrated: true });
  },

  refresh: async () => {
    const projects = await listProjects();
    set({ projects });
  },

  openProject: async (id) => {
    const project = await getProject(id);
    if (project) set({ active: project, error: null, warnings: [] });
    return project;
  },

  createProject: async (idea) => {
    const now = Date.now();
    const project: ProjectRecord = {
      id: createId("proj"),
      idea: idea.trim(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      analysis: null,
      questions: [],
      answers: [],
      definition: null,
      artifacts: {
        prd: null,
        features: [],
        flows: [],
        uiDesign: null,
        assetPlan: null,
        architecture: null,
        dataModel: null,
        api: null,
        tasks: [],
        agentInstructions: null,
        canonical: { requirements: [], entities: [], enums: [], stateMachines: [], apiOperations: [], screens: [] },
      },
      artifactStatus: createEmptyArtifactStatus(),
      validation: null,
      editHistory: [],
    };
    const saved = await saveProject(project);
    set({ active: saved, error: null, warnings: [] });
    await get().refresh();
    return saved;
  },

  patchProject: async (updater) => {
    const active = get().active;
    if (!active) return;
    const next = updater(active);
    const saved = await saveProject(next);
    set({ active: saved });
    set({ projects: get().projects.map((project) => (project.id === saved.id ? saved : project)) });
  },

  removeProject: async (id) => {
    await deleteProjectRecord(id);
    set({
      projects: get().projects.filter((project) => project.id !== id),
      active: get().active?.id === id ? null : get().active,
    });
  },

  importProject: async (json) => {
    const parsed = parseProjectFile(json);
    const now = Date.now();
    const imported: ProjectRecord = {
      ...parsed,
      id: createId("proj"),
      createdAt: now,
      updatedAt: now,
    };
    const saved = await saveProject(imported);
    await get().refresh();
    set({ active: saved });
    return saved;
  },

  analyzeIdea: async (id) => {
    set({ busy: true, busyStage: "definition", error: null, progress: { label: "analyze", value: 10 } });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");
      const response = await callStep<{ analysis: ProjectRecord["analysis"] }>(
        "analyze",
        { idea: project.idea },
        provider(),
      );
      await get().patchProject((current) => ({
        ...current,
        analysis: response.analysis,
        status: "clarifying",
      }));
    } catch (error) {
      set({ error: toErrorState(error) });
      throw error;
    } finally {
      set({ busy: false, busyStage: null, progress: null });
    }
  },

  generateQuestions: async (id) => {
    set({ busy: true, error: null, progress: { label: "clarify", value: 40 } });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");
      const analysis = project.analysis;
      if (!analysis) throw new Error("Analisis ide belum tersedia.");
      const response = await callStep<{ questions: ProjectRecord["questions"] }>(
        "clarify",
        { idea: project.idea, analysis },
        provider(),
      );
      await get().patchProject((current) => ({
        ...current,
        questions: response.questions,
        status: "clarifying",
      }));
    } catch (error) {
      set({ error: toErrorState(error) });
      throw error;
    } finally {
      set({ busy: false, progress: null });
    }
  },

  answerQuestion: async (id, questionId, answer) => {
    await get().patchProject((project) => ({
      ...project,
      answers: [...project.answers.filter((entry) => entry.questionId !== questionId), answer],
    }));
    void id;
  },

  buildDefinition: async (id) => {
    set({ busy: true, error: null, progress: { label: "definition", value: 70 } });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");
      const response = await callStep<{ definition: ProjectRecord["definition"] }>(
        "definition",
        {
          idea: project.idea,
          analysis: project.analysis,
          questions: project.questions,
          answers: project.answers,
        },
        provider(),
      );
      await get().patchProject((current) => ({
        ...current,
        definition: response.definition,
        status: "review",
      }));
    } catch (error) {
      set({ error: toErrorState(error) });
      throw error;
    } finally {
      set({ busy: false, progress: null });
    }
  },

  generateSpecification: async (id) => {
    set({
      busy: true,
      error: null,
      warnings: [],
      progress: { label: "features", value: 0 },
    });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");
      if (!project.definition) throw new Error("Project definition belum dibuat.");

      await get().patchProject((current) => ({ ...current, status: "generating" }));

      const result = await generateArtifacts({
        project: get().active ?? project,
        provider: provider(),
        keys: [...ARTIFACT_KEYS],
        onStageStart: (stage) =>
          set({ busyStage: stage, progress: { label: stage, value: get().progress?.value ?? 0 } }),
        onProgress: (progress) => set({ progress }),
        onResult: async (stepResult) => {
          await get().patchProject((current) => ({
            ...current,
            artifacts: { ...current.artifacts, ...stepResult.patch },
            artifactStatus: statusPatch(current, stepResult.key, {
              status: stepResult.status,
              error: stepResult.error,
              warnings: stepResult.warnings,
              updatedAt: stepResult.status === "ready" ? Date.now() : null,
            }),
            warnings: [],
          }));
          if (stepResult.warnings.length > 0) {
            set({ warnings: [...new Set([...get().warnings, ...stepResult.warnings])] });
          }
        },
      });

      const failedSteps = result.failed.concat(result.skipped);
      await get().patchProject((current) => ({
        ...current,
        // Keep the project on the review screen when something failed, so the
        // retry affordance stays in front of the user (PRD NFR-003).
        status: failedSteps.length === 0 ? "ready" : "review",
      }));

      if (result.failed.length === 0) {
        set({ progress: { label: "memeriksa konsistensi", value: 100 } });
        await get().validatePackage(id);
        const issues = get().active?.validation?.issues ?? [];
        if (issues.some(isBlockingIssue)) {
          await get().autoFixIssues(id);
        }
      }
    } catch (error) {
      set({ error: toErrorState(error) });
      throw error;
    } finally {
      set({ busy: false, busyStage: null, progress: null });
    }
  },

  regenerateArtifacts: async (id, keys) => {
    set({ busy: true, error: null, warnings: [], progress: { label: keys[0] ?? "", value: 0 } });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");
      if (!project.definition) throw new Error("Project definition belum dibuat.");

      const result = await generateArtifacts({
        project,
        provider: provider(),
        keys,
        onStageStart: (stage) => set({ busyStage: stage }),
        onProgress: (progress) => set({ progress }),
        onResult: async (stepResult) => {
          await get().patchProject((current) => ({
            ...current,
            artifacts: { ...current.artifacts, ...stepResult.patch },
            artifactStatus: statusPatch(current, stepResult.key, {
              status: stepResult.status,
              error: stepResult.error,
              warnings: stepResult.warnings,
              updatedAt: stepResult.status === "ready" ? Date.now() : null,
            }),
          }));
          if (stepResult.warnings.length > 0) {
            set({ warnings: [...new Set([...get().warnings, ...stepResult.warnings])] });
          }
        },
      });

      const remaining = await get().openProject(id);
      if (remaining) {
        const hasFailure = ARTIFACT_KEYS.some(
          (key) => remaining.artifactStatus[key]?.status === "failed",
        );
        if (!hasFailure) {
          await get().patchProject((current) => ({ ...current, status: "ready" }));
        }
      }
      void result;

      await get().validatePackage(id);
    } catch (error) {
      set({ error: toErrorState(error) });
      throw error;
    } finally {
      set({ busy: false, busyStage: null, progress: null });
    }
  },

  validatePackage: async (id) => {
    try {
      const project = await get().openProject(id);
      if (!project) return;
      const result = await runValidationStep(project, provider());
      await get().patchProject((current) => ({
        ...current,
        // A fresh check starts the automatic-repair counter over.
        validation: { checkedAt: Date.now(), issues: result.issues, autoFixed: 0 },
      }));
      if (result.warnings.length > 0) {
        set({ warnings: [...new Set([...get().warnings, ...result.warnings])] });
      }
    } catch (error) {
      set({ warnings: [...new Set([...get().warnings, toErrorState(error).message])] });
    }
  },

  autoFixIssues: async (id) => {
    // Demo mode cannot rewrite anything, so there is nothing to repair.
    if (provider().mode !== "live") return 0;

    set({ busy: true, error: null, progress: { label: "memeriksa temuan", value: 100 } });
    let fixed = 0;

    try {
      for (let round = 0; round < AUTO_FIX_ROUNDS; round += 1) {
        const project = await get().openProject(id);
        if (!project) break;

        const issues = project.validation?.issues ?? [];
        const blocking = issues.filter(isBlockingIssue);
        if (blocking.length === 0) break;

        const plans = planRepairs(blocking, issues);
        if (plans.length === 0) break;

        const affected = new Set<ArtifactKey>();
        for (const [index, plan] of plans.entries()) {
          set({
            busyStage: plan.target,
            progress: {
              label: `perbaikan otomatis ${index + 1}/${plans.length}`,
              value: Math.round((index / plans.length) * 100),
            },
          });

          const current = await get().openProject(id);
          if (!current) break;

          const response = await callStep<EditStepResult>(
            "edit",
            editBody(current, plan.target, buildRepairInstruction(plan.target, plan.issues)),
            provider(),
          );
          const affectedKeys = (response.affected ?? []).filter((key) =>
            (ARTIFACT_KEYS as readonly string[]).includes(key),
          );
          for (const key of affectedKeys) affected.add(key);

          await get().patchProject((state) =>
            applyEditPatch(state, response.patch ?? {}, affectedKeys),
          );
        }

        if (affected.size > 0) {
          await get().regenerateArtifacts(id, [...affected]);
        } else {
          await get().validatePackage(id);
        }

        const after = await get().openProject(id);
        const remaining = (after?.validation?.issues ?? []).map((issue) => issue.summary);
        fixed += issues.filter((issue) => !remaining.includes(issue.summary)).length;
        if (!(after?.validation?.issues ?? []).some(isBlockingIssue)) break;
      }

      if (fixed > 0) {
        await get().patchProject((project) =>
          project.validation
            ? { ...project, validation: { ...project.validation, autoFixed: fixed } }
            : project,
        );
      }
      return fixed;
    } catch (error) {
      // A failed repair pass must not discard the package that was generated (PRD NFR-003).
      set({ error: { message: `Perbaikan otomatis belum berhasil: ${toErrorState(error).message}` } });
      return fixed;
    } finally {
      set({ busy: false, busyStage: null, progress: null });
    }
  },

  applyInstruction: async (id, target, instruction) => {
    set({ busy: true, busyStage: target as PipelineStage, error: null });
    try {
      const project = await get().openProject(id);
      if (!project) throw new Error("Proyek tidak ditemukan.");

      const response = await callStep<EditStepResult>(
        "edit",
        editBody(project, target, instruction),
        provider(),
      );

      const affected = (response.affected ?? []).filter((key) =>
        (ARTIFACT_KEYS as readonly string[]).includes(key),
      );

      await get().patchProject((current) => ({
        ...applyEditPatch(current, response.patch ?? {}, affected),
        editHistory: [
          {
            id: `edit-${Date.now()}`,
            instruction,
            summary: response.summary ?? "",
            at: Date.now(),
            scope: target,
            affected,
            succeeded: true,
          },
          ...current.editHistory,
        ],
      }));

      if (affected.length > 0) {
        await get().regenerateArtifacts(id, affected);
      }
    } catch (error) {
      const state = toErrorState(error);
      set({ error: state });
      const project = get().active;
      if (project) {
        await get().patchProject((current) => ({
          ...current,
          editHistory: [
            {
              id: `edit-${Date.now()}`,
              instruction,
              summary: state.message,
              at: Date.now(),
              scope: target,
              affected: [],
              succeeded: false,
            },
            ...current.editHistory,
          ],
        }));
      }
      throw error;
    } finally {
      set({ busy: false, busyStage: null });
    }
  },

  setError: (error) => set({ error }),
  clearWarnings: () => set({ warnings: [] }),
}));

function toErrorState(error: unknown): { message: string; code?: string } {
  if (error && typeof error === "object" && "message" in error) {
    const code = "code" in error ? String((error as { code: unknown }).code) : undefined;
    return { message: String((error as { message: unknown }).message), code };
  }
  return { message: "Terjadi kesalahan tak terduga." };
}
