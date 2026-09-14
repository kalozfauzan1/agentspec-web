import {
  FRONTEND_FIRST_PHASES,
  type ApiSpec,
  type ArchitectureSpec,
  type DataModelSpec,
  type FeatureSpec,
  type ImplementationTask,
  type ProjectDefinition,
  type Requirement,
  type SpecDocument,
} from "@/lib/schemas";

const REQUIREMENT_ID = /^[A-Z][A-Z0-9]{1,9}-\d{2,4}$/;

export function makePrefix(name: string) {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (letters.length === 0) return "REQ";
  if (letters.length === 1) return letters[0].slice(0, 4);
  return letters
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .slice(0, 6);
}

export function slugId(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function uniqueId(candidate: string, taken: Set<string>, fallback: string) {
  const base = candidate || fallback;
  let id = base;
  let counter = 2;
  while (taken.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  taken.add(id);
  return id;
}

/* ------------------------------------------------------------------ */
/* Features                                                           */
/* ------------------------------------------------------------------ */

export function normalizeFeatures(
  input: FeatureSpec[],
  definition: ProjectDefinition | null,
): FeatureSpec[] {
  const usedFeatureIds = new Set<string>();
  const features = input.map((feature, index) => {
    const prefix =
      (feature.prefix || makePrefix(feature.name))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8) || `FEAT${index + 1}`;
    const id = uniqueId(
      slugId(feature.id, `feature-${index + 1}`),
      usedFeatureIds,
      `feature-${index + 1}`,
    );

    const usedRequirementIds = new Set<string>();
    const requirements: Requirement[] = feature.requirements
      .filter((requirement) => requirement.text.trim().length > 0)
      .map((requirement, requirementIndex) => {
        const fallbackId = `${prefix}-${pad(requirementIndex + 1)}`;
        const candidate = requirement.id?.toUpperCase().trim() ?? "";
        const id = REQUIREMENT_ID.test(candidate)
          ? uniqueId(candidate, usedRequirementIds, fallbackId)
          : uniqueId(fallbackId, usedRequirementIds, fallbackId);
        return { id, text: requirement.text.trim() };
      });

    return {
      ...feature,
      id,
      prefix,
      name: feature.name.trim(),
      purpose: feature.purpose.trim(),
      actors: unique(feature.actors),
      mainFlow: unique(feature.mainFlow),
      requirements,
      businessRules: unique(feature.businessRules),
      edgeCases: unique(feature.edgeCases),
      acceptanceCriteria: unique(feature.acceptanceCriteria),
    };
  });

  if (!definition || definition.features.length === 0) return features;

  // Keep feature specs in the same order as the project definition outlines.
  const outlineOrder = new Map(
    definition.features.map((outline, index) => [outline.name.toLowerCase().trim(), index]),
  );
  return features
    .map((feature, index) => ({ feature, index }))
    .sort((a, b) => {
      const rankA = outlineOrder.get(a.feature.name.toLowerCase().trim()) ?? Number.MAX_SAFE_INTEGER;
      const rankB = outlineOrder.get(b.feature.name.toLowerCase().trim()) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.index - b.index;
    })
    .map((entry) => entry.feature);
}

/* ------------------------------------------------------------------ */
/* Tasks                                                              */
/* ------------------------------------------------------------------ */

export function allowedPhases(definition: ProjectDefinition | null, features: FeatureSpec[]) {
  const strategy = definition?.implementation.strategy ?? "frontend-first";
  if (strategy === "module-first") {
    return [
      "Foundation",
      ...features.map((feature) => feature.name),
      "Integration",
      "Testing & Validation",
    ];
  }
  return [...FRONTEND_FIRST_PHASES];
}

export function normalizeTasks(
  input: ImplementationTask[],
  features: FeatureSpec[],
  definition: ProjectDefinition | null,
): ImplementationTask[] {
  const phases = allowedPhases(definition, features);
  const featureIds = new Set(features.map((feature) => feature.id));
  const requirementIds = new Set(
    features.flatMap((feature) => feature.requirements.map((requirement) => requirement.id)),
  );

  const { tasks: identified, idMap } = assignTaskIds(input);
  const idSet = new Set(identified.map((task) => task.id));
  const phaseRank = new Map(phases.map((phase, index) => [phase, index]));

  const prepared: ImplementationTask[] = identified.map((task) => {
    const phase = resolvePhase(task.phase, task.type, phases, phaseRank);
    const dependencies = task.dependencies
      .map((dependency) => idMap.get(dependency.toUpperCase().trim()) ?? dependency.toUpperCase().trim())
      .filter((dependency) => idSet.has(dependency) && dependency !== task.id);
    const references = task.references
      .map((reference) => reference.toUpperCase().trim())
      .filter((reference) => requirementIds.size === 0 || requirementIds.has(reference));
    const featureId = featureIds.has(task.featureId) ? task.featureId : "";
    const isFrontendFacing = task.type === "frontend" || task.type === "integration";

    return {
      ...task,
      phase,
      featureId,
      dependencies: unique(dependencies),
      references: unique(references),
      requirements: unique(task.requirements),
      acceptanceCriteria: unique(task.acceptanceCriteria),
      uiStates: isFrontendFacing ? unique(task.uiStates) : [],
      contextDocs: normalizeContextDocs(task.contextDocs, featureId, features),
    };
  });

  const order = new Map(prepared.map((task, index) => [task.id, index]));
  const rank = new Map(
    prepared.map((task) => [task.id, phaseRank.get(task.phase) ?? phases.length]),
  );

  // First satisfy dependencies, then restore phase order so the exported plan
  // reads top-to-bottom in execution order.
  const sorted = topologicalSort(prepared, {
    compare: (a, b) => (rank.get(a.id)! - rank.get(b.id)!) || (order.get(a.id)! - order.get(b.id)!),
  });
  const depth = new Map(sorted.map((task, index) => [task.id, index]));
  const ordered = [...sorted].sort(
    (a, b) => (rank.get(a.id)! - rank.get(b.id)!) || (depth.get(a.id)! - depth.get(b.id)!),
  );

  // Drop dependency edges that point forward after ordering so the listed
  // order always satisfies every task's dependencies.
  const position = new Map(ordered.map((task, index) => [task.id, index]));
  return ordered.map((task) => ({
    ...task,
    dependencies: task.dependencies.filter(
      (dependency) => (position.get(dependency) ?? -1) < (position.get(task.id) ?? 0),
    ),
  }));
}

function resolvePhase(
  rawPhase: string,
  type: ImplementationTask["type"],
  phases: string[],
  phaseRank: Map<string, number>,
) {
  const normalized = rawPhase?.trim() ?? "";
  if (phaseRank.has(normalized)) return normalized;

  const lower = normalized.toLowerCase();
  const exact = phases.find((phase) => phase.toLowerCase() === lower);
  if (exact) return exact;

  const partial = phases.find(
    (phase) => lower.length > 3 && phase.toLowerCase().includes(lower),
  );
  if (partial) return partial;

  const byType: Record<ImplementationTask["type"], string> = {
    foundation: "Project Foundation",
    frontend: "Frontend Features",
    backend: "Backend Features",
    database: "Backend Foundation",
    integration: "Integration",
    testing: "Testing & Validation",
    documentation: "Testing & Validation",
  };
  const mapped = byType[type] ?? phases[0];
  return phaseRank.has(mapped) ? mapped : phases[0];
}

function normalizeContextDocs(docs: string[], featureId: string, features: FeatureSpec[]) {
  const known = new Set([
    "docs/PRD.md",
    "docs/user-flows.md",
    "docs/architecture.md",
    "docs/data-model.md",
    "docs/api.md",
    "AGENTS.md",
  ]);
  const feature = features.find((candidate) => candidate.id === featureId);
  const result = new Set<string>();

  for (const doc of docs) {
    const cleaned = doc.trim().replace(/^\.?\//, "");
    if (!cleaned) continue;
    if (known.has(cleaned) || cleaned.startsWith("docs/")) result.add(cleaned);
  }
  if (feature) result.add(`docs/features/${feature.id}.md`);
  if (result.size === 0) result.add("docs/PRD.md");
  return Array.from(result);
}

function topologicalSort(
  tasks: ImplementationTask[],
  options: { compare: (a: ImplementationTask, b: ImplementationTask) => number },
): ImplementationTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seed = [...tasks].sort(options.compare);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const output: ImplementationTask[] = [];

  const visit = (task: ImplementationTask) => {
    if (visited.has(task.id) || visiting.has(task.id)) return;
    visiting.add(task.id);
    for (const dependencyId of task.dependencies) {
      const dependency = byId.get(dependencyId);
      if (dependency) visit(dependency);
    }
    visiting.delete(task.id);
    visited.add(task.id);
    output.push(task);
  };

  for (const task of seed) visit(task);
  return output;
}

/* ------------------------------------------------------------------ */
/* Other artifacts                                                    */
/* ------------------------------------------------------------------ */

export function normalizeApi(input: ApiSpec, features: FeatureSpec[]): ApiSpec {
  const featureIds = new Set(features.map((feature) => feature.id));
  const usedIds = new Set<string>();
  const byRoute = new Map<string, number>();
  const endpoints: ApiSpec["endpoints"] = [];

  input.endpoints
    .filter((endpoint) => endpoint.path.trim().length > 0)
    .forEach((endpoint, index) => {
      const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`;
      const featureId = featureIds.has(endpoint.featureId) ? endpoint.featureId : "";
      const routeKey = `${endpoint.method} ${path.toLowerCase()}`;
      const existingIndex = byRoute.get(routeKey);

      // The same endpoint can be produced by the feature batch and the
      // cross-cutting batch; keep one entry and merge what each call knew.
      if (existingIndex !== undefined) {
        const existing = endpoints[existingIndex];
        endpoints[existingIndex] = {
          ...existing,
          featureId: existing.featureId || featureId,
          actor: existing.actor || endpoint.actor,
          purpose: existing.purpose || endpoint.purpose,
          request: existing.request || endpoint.request,
          response: existing.response || endpoint.response,
          errors:
            existing.errors.length >= endpoint.errors.length ? existing.errors : endpoint.errors,
        };
        return;
      }

      const id = uniqueId(
        slugId(endpoint.id, `${endpoint.method.toLowerCase()}-${slugId(path, `endpoint-${index + 1}`)}`),
        usedIds,
        `endpoint-${index + 1}`,
      );

      byRoute.set(routeKey, endpoints.length);
      endpoints.push({
        ...endpoint,
        id,
        path,
        featureId,
        errors: endpoint.errors.filter((error) => error.status.trim().length > 0),
      });
    });

  return { ...input, endpoints };
}

export function normalizeDataModel(input: DataModelSpec): DataModelSpec {
  const entities = input.entities
    .filter((entity) => entity.name.trim().length > 0)
    .map((entity) => ({
      ...entity,
      name: entity.name.trim(),
      fields: entity.fields.filter((field) => field.name.trim().length > 0),
    }));
  const names = new Set(entities.map((entity) => entity.name.toLowerCase()));
  return {
    ...input,
    entities,
    relationships: input.relationships.filter(
      (relationship) =>
        names.has(relationship.from.toLowerCase()) && names.has(relationship.to.toLowerCase()),
    ),
  };
}

export function normalizeArchitecture(input: ArchitectureSpec): ArchitectureSpec {
  const seen = new Set<string>();
  const decisions = input.decisions
    .filter((decision) => decision.component.trim().length > 0)
    .filter((decision) => {
      const key = decision.component.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Undecided decisions must never carry a technology (PRD §17).
    .map((decision) => ({
      ...decision,
      component: decision.component.trim(),
      technology: decision.source === "undecided" ? null : decision.technology?.trim() || null,
      rationale: decision.rationale.trim(),
      alternatives: unique(decision.alternatives),
    }));

  return { ...input, decisions };
}

export function normalizeDocument(input: SpecDocument, fallbackTitle: string): SpecDocument {
  const usedIds = new Set<string>();
  return {
    title: input.title?.trim() || fallbackTitle,
    summary: input.summary?.trim() ?? "",
    sections: input.sections
      .filter((section) => section.title.trim().length > 0)
      .map((section, index) => ({
        ...section,
        id: uniqueId(slugId(section.id, `section-${index + 1}`), usedIds, `section-${index + 1}`),
        title: section.title.trim(),
        blocks: section.blocks.filter((block) => {
          if (block.type === "paragraph" || block.type === "callout") return block.text.trim().length > 0;
          if (block.type === "code") return block.code.trim().length > 0;
          if (block.type === "table") return block.columns.length > 0 && block.rows.length > 0;
          return block.items.length > 0;
        }),
      })),
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function pad(value: number) {
  return String(value).padStart(3, "0");
}

/**
 * Batching means task ids can collide or drift between calls. Every id becomes
 * TASK-###, duplicates are renumbered, and dependencies that pointed at a
 * duplicated id keep pointing at the first task that owned it.
 */
function assignTaskIds(input: ImplementationTask[]) {
  const format = (value: number) => `TASK-${String(value).padStart(3, "0")}`;
  const used = new Set<string>();
  const idMap = new Map<string, string>();

  const nextFree = () => {
    let number = 1;
    while (used.has(format(number))) number += 1;
    return format(number);
  };

  const tasks = input.map((task) => {
    const raw = task.id?.toUpperCase().trim() ?? "";
    const digits = /(\d+)/.exec(raw)?.[1];
    let id = digits ? format(Number(digits)) : "";
    if (!id || used.has(id)) id = nextFree();
    used.add(id);
    if (raw && !idMap.has(raw)) idMap.set(raw, id);
    return { ...task, id };
  });

  return { tasks, idMap };
}
