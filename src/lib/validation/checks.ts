import type {
  ApiSpec,
  ArchitectureSpec,
  ConsistencyIssue,
  DataModelSpec,
  FeatureSpec,
  ImplementationTask,
  ProjectDefinition,
  SpecDocument,
  UserFlow,
} from "@/lib/schemas";
import { allowedPhases } from "@/lib/ai/normalize";

export interface ValidationInput {
  definition: ProjectDefinition | null;
  features: FeatureSpec[];
  flows: UserFlow[];
  architecture: ArchitectureSpec | null;
  dataModel: DataModelSpec | null;
  api: ApiSpec | null;
  tasks: ImplementationTask[];
  prd: SpecDocument | null;
  agentInstructions: SpecDocument | null;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "with", "in", "on", "by", "is", "are", "be",
  "yang", "dan", "atau", "untuk", "dengan", "pada", "di", "ke", "dari", "tidak", "tanpa",
]);

function keywords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP_WORDS.has(word));
}

const UI_TASK_PATTERN =
  /\b(screen|page|view|ui|layout|component|form|list|table|dashboard|modal|dialog|button|navigation|flow)\b/i;

/** Only frontend tasks whose title renders a surface need documented UI states. */
function isUiTask(task: ImplementationTask) {
  return UI_TASK_PATTERN.test(task.title);
}

/**
 * Structural checks that do not need a model. They run in every mode so that
 * broken references never reach the exported package (PRD §28).
 */
export function runDeterministicChecks(input: ValidationInput): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const push = (issue: Omit<ConsistencyIssue, "id">) => {
    issues.push({ id: `check-${issues.length + 1}`, ...issue });
  };

  const { definition, features, flows, architecture, dataModel, api, tasks } = input;

  if (!definition) {
    push({
      severity: "high",
      area: "definition",
      summary: "Project definition belum ada.",
      detail: "Semua dokumen lain diturunkan dari project definition, jadi definition harus ada lebih dulu.",
      artifacts: ["definition"],
      suggestion: "Jalankan langkah pembuatan project definition.",
    });
    return issues;
  }

  if (features.length === 0) {
    push({
      severity: "high",
      area: "features",
      summary: "Belum ada feature specification.",
      detail: "Project definition memuat fitur, tetapi belum ada spesifikasi yang dihasilkan untuk fitur tersebut.",
      artifacts: ["features"],
      suggestion: "Generate ulang feature specifications.",
    });
  }

  for (const feature of features) {
    if (feature.requirements.length === 0) {
      push({
        severity: "high",
        area: "features",
        summary: `Feature "${feature.name}" tidak punya requirement ber-ID.`,
        detail: "Requirement id dipakai task untuk merujuk pekerjaan. Tanpa id, task tidak bisa ditelusuri.",
        artifacts: ["features", "tasks"],
        suggestion: "Tambahkan requirement dengan id berurutan (mis. PREFIX-001).",
      });
    }
    if (feature.acceptanceCriteria.length === 0) {
      push({
        severity: "medium",
        area: "features",
        summary: `Feature "${feature.name}" tidak punya acceptance criteria.`,
        detail: "Acceptance criteria dipakai coding agent untuk tahu kapan pekerjaan selesai.",
        artifacts: ["features"],
        suggestion: "Tambahkan minimal satu acceptance criterion yang bisa diverifikasi.",
      });
    }
  }

  const requirementOwners = new Map<string, string[]>();
  for (const feature of features) {
    for (const requirement of feature.requirements) {
      const owners = requirementOwners.get(requirement.id) ?? [];
      owners.push(feature.name);
      requirementOwners.set(requirement.id, owners);
    }
  }
  for (const [id, owners] of requirementOwners) {
    if (owners.length > 1) {
      push({
        severity: "high",
        area: "features",
        summary: `Requirement id ${id} dipakai lebih dari satu feature.`,
        detail: `Id yang sama muncul di: ${owners.join(", ")}.`,
        artifacts: ["features", "tasks"],
        suggestion: "Pastikan setiap requirement id unik supaya rujukan task tidak ambigu.",
      });
    }
  }

  const featureIds = new Set(features.map((feature) => feature.id));
  for (const flow of flows) {
    if (flow.featureId && !featureIds.has(flow.featureId)) {
      push({
        severity: "medium",
        area: "flows",
        summary: `User flow "${flow.name}" merujuk feature yang tidak ada.`,
        detail: `featureId "${flow.featureId}" tidak ditemukan pada feature specifications.`,
        artifacts: ["flows", "features"],
        suggestion: "Perbaiki rujukan feature pada flow tersebut.",
      });
    }
  }

  const phases = allowedPhases(definition, features);
  const phaseSet = new Set(phases);
  for (const task of tasks) {
    if (!phaseSet.has(task.phase)) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task ${task.id} memakai phase di luar strategi ${definition.implementation.strategy}.`,
        detail: `Phase "${task.phase}" tidak termasuk daftar phase strategi.`,
        artifacts: ["tasks"],
        suggestion: `Gunakan salah satu phase: ${phases.join(", ")}.`,
      });
    }
    if (task.type === "frontend" && task.uiStates.length === 0 && isUiTask(task)) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task frontend ${task.id} tidak mendefinisikan UI state.`,
        detail: "PRD mewajibkan task frontend menjelaskan state loading, empty, populated, dan error yang relevan.",
        artifacts: ["tasks"],
        suggestion: "Tambahkan daftar uiStates pada task tersebut.",
      });
    }
    if (task.dependencies.length === 0 && task.type !== "foundation" && !task.title.toLowerCase().includes("foundation")) {
      push({
        severity: "low",
        area: "tasks",
        summary: `Task ${task.id} tidak punya dependency.`,
        detail: "Task tanpa dependency berisiko dikerjakan sebelum fondasinya siap.",
        artifacts: ["tasks"],
        suggestion: "Tautkan task ini ke task fondasi yang relevan bila memang ada ketergantungan.",
      });
    }
    if (task.requirements.length > 8) {
      push({
        severity: "low",
        area: "tasks",
        summary: `Task ${task.id} terlihat terlalu besar.`,
        detail: `Task ini memuat ${task.requirements.length} requirement sekaligus, sehingga sulit diselesaikan dalam satu langkah agent.`,
        artifacts: ["tasks"],
        suggestion: "Pecah task menjadi beberapa task yang lebih kecil.",
      });
    }
    if (task.references.length === 0 && task.featureId) {
      push({
        severity: "low",
        area: "tasks",
        summary: `Task ${task.id} tidak merujuk requirement mana pun.`,
        detail: "Task fitur sebaiknya menunjuk requirement id agar bisa ditelusuri ke spesifikasi.",
        artifacts: ["tasks"],
        suggestion: "Tambahkan references dari requirement feature terkait.",
      });
    }
  }

  for (const decision of architecture?.decisions ?? []) {
    const explicit = definition.technicalPreferences.find(
      (preference) => preference.component.toLowerCase() === decision.component.toLowerCase(),
    );
    if (explicit?.source === "user-selected" && decision.source !== "user-selected") {
      push({
        severity: "high",
        area: "architecture",
        summary: `Pilihan user untuk ${decision.component} tidak dipertahankan.`,
        detail: `User memilih "${explicit.technology ?? "-"}", tetapi arsitektur mencatat "${decision.technology ?? "-"}" sebagai "${decision.source}".`,
        artifacts: ["architecture"],
        suggestion: "Kembalikan keputusan tersebut ke User Selected dan pakai teknologi yang dipilih user.",
      });
    }
    if (decision.source === "undecided" && decision.technology) {
      push({
        severity: "high",
        area: "architecture",
        summary: `${decision.component} berstatus Undecided tapi sudah diisi teknologi.`,
        detail: "Keputusan yang belum diambil tidak boleh tampil seolah sudah dipilih.",
        artifacts: ["architecture"],
        suggestion: "Kosongkan teknologi atau ubah sumbernya menjadi Recommended.",
      });
    }
  }

  for (const endpoint of api?.endpoints ?? []) {
    if (endpoint.featureId && !featureIds.has(endpoint.featureId)) {
      push({
        severity: "medium",
        area: "api",
        summary: `Endpoint ${endpoint.method} ${endpoint.path} merujuk feature yang tidak ada.`,
        detail: `featureId "${endpoint.featureId}" tidak ditemukan.`,
        artifacts: ["api", "features"],
        suggestion: "Perbaiki rujukan feature atau hapus endpoint bila tidak dibutuhkan.",
      });
    }
  }

  if (definition.nonGoals.length === 0) {
    push({
      severity: "low",
      area: "scope",
      summary: "Non-goals belum dinyatakan secara eksplisit.",
      detail: "Coding agent butuh daftar hal yang tidak boleh dikerjakan.",
      artifacts: ["definition", "prd"],
      suggestion: "Tambahkan minimal satu non-goal pada project definition.",
    });
  }

  // A feature only collides with a non-goal when the non-goal names it, or when
  // every significant word of the feature name appears in the same non-goal.
  for (const feature of features) {
    const featureWords = keywords(feature.name);
    const collides = definition.nonGoals.some((goal) => {
      const goalText = goal.toLowerCase();
      if (feature.name.trim().length > 4 && goalText.includes(feature.name.toLowerCase().trim())) {
        return true;
      }
      if (featureWords.length < 2) return false;
      const goalWords = new Set(keywords(goal));
      return featureWords.every((word) => goalWords.has(word));
    });

    if (collides) {
      push({
        severity: "high",
        area: "scope",
        summary: `Feature "${feature.name}" bertabrakan dengan non-goals.`,
        detail: "Feature ini namanya muncul pada daftar hal yang dinyatakan di luar cakupan.",
        artifacts: ["features", "prd"],
        suggestion: "Pastikan non-goal dan feature tidak saling bertentangan.",
      });
    }
  }

  const usedEntityNames = new Set(dataModel?.relationships.flatMap((relationship) => [relationship.from, relationship.to]) ?? []);
  for (const entity of dataModel?.entities ?? []) {
    if (entity.name !== "users" && !usedEntityNames.has(entity.name)) {
      push({
        severity: "low",
        area: "data-model",
        summary: `Entity "${entity.name}" belum terhubung ke entity lain.`,
        detail: "Entity tanpa relationship biasanya menandakan model data yang belum lengkap.",
        artifacts: ["data-model"],
        suggestion: "Tambahkan relasi atau jelaskan mengapa entity ini berdiri sendiri.",
      });
    }
  }

  return issues;
}
