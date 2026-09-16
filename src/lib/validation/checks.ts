import type {
  ApiSpec,
  ArchitectureSpec,
  AssetPlanSpec,
  ConsistencyIssue,
  DataModelSpec,
  FeatureSpec,
  ImplementationTask,
  ProjectDefinition,
  SpecDocument,
  UiDesignSpec,
  UserFlow,
} from "@/lib/schemas";
import { allowedPhases } from "@/lib/ai/normalize";
import { buildCanonicalSpec } from "@/lib/canonical/registry";
import { computeRequirementCoverage } from "@/lib/validation/coverage";
import { findMissingFoundationalDeps, validateTaskGraph } from "@/lib/validation/dag";

export interface ValidationInput {
  definition: ProjectDefinition | null;
  features: FeatureSpec[];
  flows: UserFlow[];
  uiDesign: UiDesignSpec | null;
  assetPlan: AssetPlanSpec | null;
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

  const { definition, features, flows, uiDesign, assetPlan, architecture, dataModel, api, tasks } = input;

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

  if (features.length > 0 && !uiDesign) {
    push({
      severity: "medium",
      area: "design",
      summary: "UI design specification belum dibuat.",
      detail:
        "Tanpa dokumen ini coding agent memilih warna, tipografi, jarak, dan komponennya sendiri, sehingga tampilan aplikasi hasil generate terlihat generik.",
      artifacts: ["uiDesign"],
      suggestion: "Generate UI design specification supaya setiap layar punya layout, komponen, dan state yang jelas.",
    });
  }

  if (uiDesign) {
    if (uiDesign.colorTokens.length === 0 || uiDesign.components.length === 0) {
      push({
        severity: "medium",
        area: "design",
        summary: "UI design belum memuat design token atau component inventory.",
        detail:
          "Tanpa token dan komponen bersama, setiap layar ditata sendiri-sendiri dan hasilnya tidak konsisten.",
        artifacts: ["uiDesign"],
        suggestion: "Lengkapi color token, typography, spacing, radius, shadow, dan daftar komponen.",
      });
    }

    const designedFeatureIds = new Set(
      uiDesign.screens.map((screen) => screen.featureId).filter(Boolean),
    );

    for (const screen of uiDesign.screens) {
      if (screen.featureId && !featureIds.has(screen.featureId)) {
        push({
          severity: "medium",
          area: "design",
          summary: `Layar "${screen.name}" merujuk feature yang tidak ada.`,
          detail: `featureId "${screen.featureId}" tidak ditemukan pada feature specifications.`,
          artifacts: ["uiDesign", "features"],
          suggestion: "Perbaiki rujukan feature layar tersebut, atau jadikan layar bersama tanpa featureId.",
        });
      }
      if (screen.states.length === 0) {
        push({
          severity: "low",
          area: "design",
          summary: `Layar "${screen.name}" tidak mendefinisikan state.`,
          detail: "Coding agent butuh daftar state (loading, empty, error) supaya tidak hanya membuat happy path.",
          artifacts: ["uiDesign"],
          suggestion: "Tambahkan state yang harus diimplementasikan pada layar tersebut.",
        });
      }
    }

    for (const feature of features) {
      if (!designedFeatureIds.has(feature.id)) {
        push({
          severity: "medium",
          area: "design",
          summary: `Feature "${feature.name}" belum punya layar pada UI design.`,
          detail: "Setiap fitur yang punya antarmuka harus dijelaskan layarnya, termasuk layout dan state-nya.",
          artifacts: ["uiDesign", "features"],
          suggestion: "Tambahkan layar untuk fitur ini pada UI design specification.",
        });
      }
    }

    if (uiDesign.platformProfiles.length < definition.platform.length) {
      const covered = new Set(uiDesign.platformProfiles.map((profile) => profile.platform.toLowerCase()));
      const missing = definition.platform.filter((platform) => !covered.has(platform.toLowerCase()));
      if (missing.length > 0) {
        push({
          severity: "medium",
          area: "design",
          summary: `Platform ${missing.join(", ")} belum punya platform profile.`,
          detail: "Coding agent butuh perilaku per platform: navigasi, unit, safe area, dan adaptive behavior.",
          artifacts: ["uiDesign"],
          suggestion: "Tambahkan platform profile untuk setiap platform di project definition.",
        });
      }
    }

    if (uiDesign.signatureMoments.length < 2) {
      push({
        severity: "low",
        area: "design",
        summary: "UI design belum menetapkan signature moment yang cukup.",
        detail: "Tanpa minimal dua momen khas, tampilan mudah jatuh ke pola dashboard generik.",
        artifacts: ["uiDesign"],
        suggestion: "Tambahkan dua atau tiga signature moment yang merujuk layar konkret.",
      });
    }
  }

  if (features.length > 0 && !assetPlan) {
    push({
      severity: "medium",
      area: "assets",
      summary: "Asset plan belum dibuat.",
      detail:
        "Tanpa rencana aset, coding agent memilih ikon, gambar, dan ilustrasinya sendiri sehingga hasilnya tidak konsisten dan berisiko melanggar lisensi.",
      artifacts: ["assetPlan"],
      suggestion: "Generate asset plan agar setiap ikon dan media punya sumber, lisensi, path lokal, dan fallback.",
    });
  }

  if (assetPlan) {
    const screenIdSet = new Set((uiDesign?.screens ?? []).map((screen) => screen.id));
    const sourceIds = new Set(assetPlan.sources.map((source) => source.id));
    const assetIds = new Set(assetPlan.assets.map((asset) => asset.id));

    if (!assetPlan.sourcePolicy.freeOnly || !assetPlan.sourcePolicy.legalOnly || !assetPlan.sourcePolicy.localOnly) {
      push({
        severity: "high",
        area: "assets",
        summary: "Kebijakan sumber aset tidak mewajibkan aset gratis, legal, dan lokal.",
        detail: "Aset harus gratis, legal, dan disimpan di repository supaya aman dipakai.",
        artifacts: ["assetPlan"],
        suggestion: "Aktifkan freeOnly, legalOnly, dan localOnly pada sourcePolicy.",
      });
    }

    if (assetPlan.iconSystems.length < definition.platform.length) {
      push({
        severity: "medium",
        area: "assets",
        summary: "Belum ada icon system untuk setiap platform.",
        detail: "Setiap platform butuh satu keluarga ikon yang konsisten agar tidak tercampur.",
        artifacts: ["assetPlan"],
        suggestion: "Tambahkan satu icon system per platform target.",
      });
    }

    for (const system of assetPlan.iconSystems) {
      if (system.mappings.length === 0) {
        push({
          severity: "low",
          area: "assets",
          summary: `Icon system ${system.platform} belum memetakan aksi ke ikon.`,
          detail: "Coding agent butuh nama ikon konkret agar tidak menebak.",
          artifacts: ["assetPlan"],
          suggestion: "Tambahkan mapping aksi ke nama ikon untuk platform tersebut.",
        });
      }
    }

    const licenses = assetPlan.sources.map((source) => source.license.toLowerCase());
    if (licenses.some((license) => /unknown|tbd|pending|unverified|unresolved|verify/.test(license))) {
      push({
        severity: "high",
        area: "assets",
        summary: "Ada sumber aset dengan lisensi yang belum jelas.",
        detail: "Lisensi tidak boleh berupa unknown, pending, atau verify-before-use.",
        artifacts: ["assetPlan"],
        suggestion: "Ganti dengan sumber gratis yang lisensinya jelas, atau hapus aset tersebut.",
      });
    }

    for (const source of assetPlan.sources) {
      if (!/^https?:\/\//i.test(source.officialUrl)) {
        push({
          severity: "medium",
          area: "assets",
          summary: `Sumber aset ${source.id} tidak punya URL resmi yang valid.`,
          detail: `officialUrl "${source.officialUrl}" tidak diawali http/https.`,
          artifacts: ["assetPlan"],
          suggestion: "Isi URL resmi sumber aset, atau hapus sumber tersebut.",
        });
      }
    }

    for (const asset of assetPlan.assets) {
      if (!sourceIds.has(asset.sourceId)) {
        push({
          severity: "high",
          area: "assets",
          summary: `Aset ${asset.id} merujuk sumber yang tidak ada.`,
          detail: `sourceId "${asset.sourceId}" tidak ditemukan pada daftar sources.`,
          artifacts: ["assetPlan"],
          suggestion: "Perbaiki sourceId aset atau tambahkan sumbernya.",
        });
      }
      if (asset.screenIds.length === 0) {
        push({
          severity: "medium",
          area: "assets",
          summary: `Aset ${asset.id} tidak dipakai di layar mana pun.`,
          detail: "Aset tanpa layar tidak bisa diimplementasikan dan biasanya hanya dekorasi.",
          artifacts: ["assetPlan", "uiDesign"],
          suggestion: "Tautkan aset ke layar yang memakainya, atau hapus aset tersebut.",
        });
      }
      for (const screenId of asset.screenIds) {
        if (!screenIdSet.has(screenId)) {
          push({
            severity: "medium",
            area: "assets",
            summary: `Aset ${asset.id} merujuk layar yang tidak ada.`,
            detail: `screenId "${screenId}" tidak ditemukan pada UI design.`,
            artifacts: ["assetPlan", "uiDesign"],
            suggestion: "Perbaiki rujukan layar aset tersebut.",
          });
        }
      }
      if (!/^[a-z0-9_./-]+\.[a-z0-9]{1,8}$/i.test(asset.destinationPath) || asset.destinationPath.startsWith("/") || asset.destinationPath.includes("..")) {
        push({
          severity: "medium",
          area: "assets",
          summary: `Aset ${asset.id} punya destinationPath yang tidak aman.`,
          detail: `"${asset.destinationPath}" harus berupa path relatif di dalam repository dengan nama file dan ekstensi.`,
          artifacts: ["assetPlan"],
          suggestion: "Gunakan path repository-local seperti public/assets/nama-file.svg.",
        });
      }
      if (!asset.fallback.trim()) {
        push({
          severity: "medium",
          area: "assets",
          summary: `Aset ${asset.id} tidak punya fallback.`,
          detail: "Tanpa fallback, aset yang gagal dimuat merusak layout.",
          artifacts: ["assetPlan"],
          suggestion: "Dokumentasikan fallback yang bisa diimplementasikan tanpa aset tersebut.",
        });
      }
    }

    for (const screen of uiDesign?.screens ?? []) {
      for (const assetId of screen.assetIds) {
        if (!assetIds.has(assetId)) {
          push({
            severity: "medium",
            area: "assets",
            summary: `Layar "${screen.name}" merujuk aset yang tidak ada.`,
            detail: `assetId "${assetId}" tidak ditemukan pada asset plan.`,
            artifacts: ["uiDesign", "assetPlan"],
            suggestion: "Perbaiki rujukan aset layar tersebut.",
          });
        }
      }
    }
  }

  const phases = allowedPhases(definition, features);
  const phaseSet = new Set(phases);
  const designScreenIds = new Set((uiDesign?.screens ?? []).map((screen) => screen.id));
  const assetPlanIds = new Set((assetPlan?.assets ?? []).map((asset) => asset.id));
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
    if (task.screenIds.some((id) => !designScreenIds.has(id))) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task ${task.id} merujuk screen id yang tidak ada.`,
        detail: `Screen yang tidak ditemukan: ${task.screenIds.filter((id) => !designScreenIds.has(id)).join(", ")}.`,
        artifacts: ["tasks", "uiDesign"],
        suggestion: "Samakan screenIds task dengan layar yang ada di UI design specification.",
      });
    }
    if (task.assetIds.some((id) => !assetPlanIds.has(id))) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task ${task.id} merujuk asset id yang tidak ada.`,
        detail: `Aset yang tidak ditemukan: ${task.assetIds.filter((id) => !assetPlanIds.has(id)).join(", ")}.`,
        artifacts: ["tasks", "assetPlan"],
        suggestion: "Samakan assetIds task dengan aset yang ada di asset plan.",
      });
    }
    if (isUiTask(task) && (task.type === "frontend" || task.type === "integration") && task.screenIds.length === 0 && (uiDesign?.screens.length ?? 0) > 0) {
      push({
        severity: "low",
        area: "tasks",
        summary: `Task UI ${task.id} tidak merujuk screen id mana pun.`,
        detail: "Task yang merender antarmuka sebaiknya menunjuk layar konkret dari UI design specification.",
        artifacts: ["tasks", "uiDesign"],
        suggestion: "Tambahkan screenIds yang sesuai pada task tersebut.",
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
    // Single source of truth: versioned API prefix.
    if (!endpoint.path.startsWith("/api/v1/")) {
      push({
        severity: "high",
        area: "api",
        summary: `Endpoint ${endpoint.method} ${endpoint.path} tidak memakai prefix /api/v1/.`,
        detail: "Task generator harus mengambil path dari canonical API registry; path tanpa versi menyebabkan mismatch /api vs /api/v1.",
        artifacts: ["api", "tasks"],
        suggestion: "Ubah path ke bentuk /api/v1/… dan referensikan via operationId.",
      });
    }
    for (const reqId of endpoint.requirementIds ?? []) {
      if (!requirementOwners.has(reqId.toUpperCase().trim())) {
        push({
          severity: "high",
          area: "api",
          summary: `Endpoint ${endpoint.method} ${endpoint.path} merujuk requirement ${reqId} yang tidak ada.`,
          detail: `Requirement "${reqId}" tidak ditemukan pada canonical requirement registry.`,
          artifacts: ["api", "features"],
          suggestion: "Samakan requirementIds endpoint dengan ID kanonis dari feature specifications.",
        });
      }
    }
  }

  // Canonical registry — single source of truth for cross-document checks.
  const canonical = buildCanonicalSpec({ features, dataModel, api, uiDesign });
  const canonicalReqIds = new Set(canonical.requirements.map((r) => r.id.toUpperCase()));
  const canonicalEntities = new Set(canonical.entities.map((e) => e.name.toLowerCase()));
  const canonicalFields = new Set(
    canonical.entities.flatMap((e) => e.fields.map((f) => f.toLowerCase())),
  );
  const canonicalOpIds = new Set(canonical.apiOperations.map((op) => op.operationId));

  // Requirement → task coverage: every functional requirement needs a task.
  for (const coverage of computeRequirementCoverage({ features, tasks, api })) {
    if (coverage.status === "uncovered") {
      push({
        severity: "high",
        area: "tasks",
        summary: `Requirement ${coverage.requirement} tidak mempunyai implementation task.`,
        detail: `REQUIREMENT_WITHOUT_IMPLEMENTATION: ${coverage.requirement} (feature ${coverage.featureId}) belum dicakup task, API ${coverage.covered_by_api.join(", ") || "—"}.`,
        artifacts: ["tasks", "features"],
        suggestion: "Tambahkan task implementasi untuk requirement ini sebelum final package PASS.",
      });
    }
  }

  // Task reference integrity against canonical registries.
  for (const task of tasks) {
    for (const ref of task.references) {
      if (!canonicalReqIds.has(ref.toUpperCase().trim())) {
        push({
          severity: "high",
          area: "tasks",
          summary: `Task ${task.id} merujuk requirement ${ref} yang tidak ada di registry kanonis.`,
          detail: `Unknown requirement ref "${ref}".`,
          artifacts: ["tasks", "features"],
          suggestion: "Samakan references task dengan requirement ID kanonis.",
        });
      }
    }
    if (task.featureId && !featureIds.has(task.featureId)) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task ${task.id} merujuk feature "${task.featureId}" yang tidak ada.`,
        detail: "FeatureId task tidak ditemukan pada feature specifications.",
        artifacts: ["tasks", "features"],
        suggestion: "Perbaiki featureId task tersebut.",
      });
    }
    for (const op of task.apiOperations ?? []) {
      if (op && !canonicalOpIds.has(op)) {
        // Allow raw paths only if they exactly match a canonical route.
        const byRoute = canonical.apiOperations.some(
          (canonicalOp) => canonicalOp.path.toLowerCase() === op.toLowerCase(),
        );
        if (!byRoute) {
          push({
            severity: "high",
            area: "tasks",
            summary: `Task ${task.id} merujuk API operation "${op}" yang tidak ada.`,
            detail: "Task harus mengambil operationId dari canonical API registry, bukan menulis URL manual.",
            artifacts: ["tasks", "api"],
            suggestion: "Ganti dengan operationId kanonis dari docs/api.md.",
          });
        }
      }
    }
    if (task.acceptanceCriteria.length > 0 && task.acceptanceCriteria.length < 2 && (task.type === "backend" || task.type === "integration")) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task ${task.id} acceptance criteria terlalu shallow.`,
        detail: `Hanya ${task.acceptanceCriteria.length} kriteria; backend/integration butuh minimal 2 yang verifiable (Given/When/Then).`,
        artifacts: ["tasks"],
        suggestion: "Tambahkan acceptance criteria Given/When/Then + validationCommands.",
      });
    }
  }

  // Task DAG validation: refs exist, acyclic, foundational deps present.
  const dag = validateTaskGraph(tasks);
  for (const unknown of dag.unknownDependencies) {
    push({
      severity: "high",
      area: "tasks",
      summary: `Task ${unknown.taskId} bergantung pada ${unknown.dependency} yang tidak ada.`,
      detail: "Referenced dependency tidak ditemukan; graph tidak valid.",
      artifacts: ["tasks"],
      suggestion: "Perbaiki dependencies ke task ID yang ada dan pastikan urutan DAG valid.",
    });
  }
  if (dag.hasCycle) {
    push({
      severity: "high",
      area: "tasks",
      summary: "Task dependency graph mengandung cycle.",
      detail: `Cycle melibatkan: ${dag.cycles.map((c) => c.join(", ")).join("; ")}.`,
      artifacts: ["tasks"],
      suggestion: "Putus cycle dengan mengatur ulang dependencies agar DAG acyclic.",
    });
  }
  for (const missing of findMissingFoundationalDeps(tasks)) {
    push({
      severity: "medium",
      area: "tasks",
      summary: `Task dependency kemungkinan missing: ${missing}.`,
      detail: "Task membutuhkan infrastructure/mock/auth tetapi dependencies kosong; execution engine DAG berjalan di explicit deps.",
      artifacts: ["tasks"],
      suggestion: "Tambahkan explicit dependency ke task fondasi yang relevan.",
    });
  }

  // Entity/table drift: relationships must point at known entities.
  const entityNames = new Set((dataModel?.entities ?? []).map((e) => e.name.toLowerCase()));
  for (const rel of dataModel?.relationships ?? []) {
    if (!entityNames.has(rel.from.toLowerCase()) || !entityNames.has(rel.to.toLowerCase())) {
      push({
        severity: "high",
        area: "data-model",
        summary: `Relationship ${rel.from} → ${rel.to} merujuk entity yang tidak ada.`,
        detail: "Unknown entity ref; kemungkinan naming drift (mis. inventory_movement_logs vs inventory_audit_logs).",
        artifacts: ["data-model"],
        suggestion: "Samakan nama entity dengan canonical registry.",
      });
    }
  }

  // SPEC_GAP heuristic: API/UI fields without a canonical domain home.
  const sketchText = [
    ...(api?.endpoints ?? []).flatMap((e) => [e.request, e.response]),
    ...(uiDesign?.screens ?? []).flatMap((s) => s.sampleContent),
  ].join("\n");
  const fieldCandidates = Array.from(
    new Set(
      (sketchText.match(/"([a-zA-Z][a-zA-Z0-9_]{2,})"\s*:/g) ?? []).map((m) =>
        m.replace(/["\s:]/g, "").toLowerCase(),
      ),
    ),
  );
  const commonFields = new Set([
    "id", "created_at", "updated_at", "name", "description", "status", "type",
    "title", "email", "password", "token", "message", "data", "error", "page",
    "limit", "offset", "total",
  ]);
  for (const field of fieldCandidates) {
    if (!canonicalFields.has(field) && !commonFields.has(field)) {
      push({
        severity: "medium",
        area: "data-model",
        summary: `SPEC_GAP: field "${field}" dipakai API/UI tetapi tidak ada di data model.`,
        detail: `Missing domain concept for "${field}"; jangan invent diam-diam — perluas canonical spec dulu.`,
        artifacts: ["api", "data-model", "uiDesign"],
        suggestion: `Tambahkan field "${field}" ke entity kanonis yang sesuai, lalu regenerate artifacts terdampak.`,
      });
      if (fieldCandidates.indexOf(field) > 7) break;
    }
  }

  // Table-name drift heuristic: snake_case plurals in tasks without canonical entity.
  const taskText = tasks.flatMap((t) => [...t.requirements, ...(t.implementationNotes ?? [])]).join("\n");
  const tableCandidates = Array.from(
    new Set((taskText.match(/\b[a-z]+_[a-z0-9_]{2,}s\b/g) ?? []).map((t) => t.toLowerCase())),
  );
  for (const table of tableCandidates.slice(0, 8)) {
    if (!canonicalEntities.has(table)) {
      push({
        severity: "medium",
        area: "tasks",
        summary: `Task merujuk table "${table}" yang tidak ada di data model.`,
        detail: `Unknown table "${table}"; kemungkinan drift (mis. inventory_audit_logs vs inventory_movement_logs).`,
        artifacts: ["tasks", "data-model"],
        suggestion: "Samakan nama table dengan canonical entity registry.",
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
