import {
  FRONTEND_FIRST_PHASES,
  type ApiSpec,
  type ArchitectureSpec,
  type AssetPlanSpec,
  type DataModelSpec,
  type DesignComponent,
  type DesignScreen,
  type DesignToken,
  type FeatureSpec,
  type ImplementationTask,
  type ProjectDefinition,
  type Requirement,
  type SpecDocument,
  type UiDesignSpec,
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

  const { tasks: identified, idMap } = assignTaskIds(input);
  const phaseRank = new Map(phases.map((phase, index) => [phase, index]));

  const prepared: ImplementationTask[] = identified.map((task) => {
    const phase = resolvePhase(task.phase, task.type, phases, phaseRank);
    // Preserve unknown dependency/reference ids so the deterministic
    // validator can flag them instead of silently dropping invention.
    const dependencies = unique(
      task.dependencies
        .map((dependency) => {
          const raw = dependency.toUpperCase().trim();
          if (!raw) return "";
          return idMap.get(raw) ?? raw;
        })
        .filter(Boolean),
    ).filter((dependency) => dependency !== task.id);
    const references = unique(
      task.references.map((reference) => reference.toUpperCase().trim()).filter(Boolean),
    );
    const featureId = task.featureId?.trim() ?? "";
    const apiOperations = unique(
      (task.apiOperations ?? []).map((op) => op.trim()).filter(Boolean),
    );
    const isFrontendFacing = task.type === "frontend" || task.type === "integration";

    return {
      ...task,
      phase,
      featureId,
      dependencies: unique(dependencies),
      references: unique(references),
      apiOperations,
      requirements: unique(task.requirements),
      implementationNotes: unique(task.implementationNotes ?? []),
      acceptanceCriteria: unique(task.acceptanceCriteria),
      validationCommands: unique(task.validationCommands ?? []),
      goal: task.goal?.trim() ?? "",
      uiStates: isFrontendFacing ? unique(task.uiStates) : [],
      screenIds: unique(task.screenIds),
      assetIds: unique(task.assetIds),
      contextDocs: normalizeContextDocs(task.contextDocs, featureId, features, isFrontendFacing),
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

  // Keep dependency edges intact so the DAG validator can flag forward
  // references and cycles instead of silently dropping them.
  return ordered;
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

function normalizeContextDocs(
  docs: string[],
  featureId: string,
  features: FeatureSpec[],
  includeDesignDoc = false,
) {
  const known = new Set([
    "docs/PRD.md",
    "docs/user-flows.md",
    "docs/ui-design.md",
    "docs/asset-plan.md",
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
  // Any task that renders UI must be implemented against the design specification
  // and the asset plan that documents its icons, media, and fallbacks.
  if (includeDesignDoc) {
    result.add("docs/ui-design.md");
    result.add("docs/asset-plan.md");
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
  const usedIds = new Set<string>();
  const byRoute = new Map<string, number>();
  const endpoints: ApiSpec["endpoints"] = [];

  input.endpoints
    .filter((endpoint) => endpoint.path.trim().length > 0)
    .forEach((endpoint, index) => {
      const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`;
      // Preserve unknown featureIds so validators flag them (no silent blanking).
      const featureId = endpoint.featureId?.trim() ?? "";
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
      const operationId =
        endpoint.operationId?.trim() ||
        `${endpoint.method.toLowerCase()}${path
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .split("-")
          .filter(Boolean)
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join("")}`;

      byRoute.set(routeKey, endpoints.length);
      endpoints.push({
        ...endpoint,
        id,
        operationId,
        path,
        featureId,
        requirementIds: unique(
          (endpoint.requirementIds ?? []).map((r) => r.toUpperCase().trim()).filter(Boolean),
        ),
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
  // Preserve relationships (even to unknown entities) so validators flag drift.
  return {
    ...input,
    entities,
    relationships: input.relationships.filter(
      (relationship) => relationship.from.trim().length > 0 && relationship.to.trim().length > 0,
    ),
  };
}

function normalizeTokens(list: DesignToken[]): DesignToken[] {
  const seen = new Set<string>();
  return list
    .map((token) => ({
      ...token,
      name: token.name.trim(),
      value: token.value.trim(),
      usage: token.usage.trim(),
    }))
    .filter((token) => token.name.length > 0 && token.value.length > 0)
    .filter((token) => {
      const key = token.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeComponents(list: DesignComponent[]): DesignComponent[] {
  const seen = new Set<string>();
  return list
    .filter((component) => component.name.trim().length > 0)
    .map((component) => ({
      ...component,
      name: component.name.trim(),
      purpose: component.purpose.trim(),
      variants: unique(component.variants),
      states: unique(component.states),
      rules: unique(component.rules),
    }))
    .filter((component) => {
      const key = component.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeUiDesign(input: UiDesignSpec, features: FeatureSpec[]): UiDesignSpec {
  void features;
  const usedScreenIds = new Set<string>();

  const components = normalizeComponents(input.components);

  const screens: DesignScreen[] = input.screens
    .filter((screen) => screen.name.trim().length > 0)
    .map((screen, index) => ({
      ...screen,
      id: uniqueId(
        slugId(screen.id || screen.name, `screen-${index + 1}`),
        usedScreenIds,
        `screen-${index + 1}`,
      ),
      name: screen.name.trim(),
      featureId: screen.featureId?.trim() ?? "",
      purpose: screen.purpose.trim(),
      layout: unique(screen.layout),
      components: unique(screen.components),
      states: unique(screen.states),
      responsive: unique(screen.responsive),
      sampleContent: unique(screen.sampleContent),
      assetIds: unique(screen.assetIds),
    }));

  // A screen may only reference components that exist in the inventory, so every
  // referenced component that the model forgot is added instead of dropped.
  const known = new Set(components.map((component) => component.name.toLowerCase()));
  for (const screen of screens) {
    for (const name of screen.components) {
      const key = name.toLowerCase();
      if (known.has(key)) continue;
      known.add(key);
      components.push({ name, purpose: "", variants: [], states: [], rules: [] });
    }
  }

  const knownScreenIds = new Set(screens.map((screen) => screen.id));

  return {
    overview: input.overview.trim(),
    styleDirection: input.styleDirection.trim(),
    creativeConcept: input.creativeConcept.trim(),
    creativeRationale: input.creativeRationale.trim(),
    themeMode: input.themeMode.trim(),
    principles: unique(input.principles),
    signatureMoments: input.signatureMoments
      .filter((moment) => moment.name.trim().length > 0)
      .map((moment) => ({
        ...moment,
        name: moment.name.trim(),
        description: moment.description.trim(),
        screenIds: unique(moment.screenIds).filter((id) => knownScreenIds.has(id)),
      })),
    fontFamilies: input.fontFamilies
      .filter((font) => font.family.trim().length > 0)
      .map((font) => ({
        ...font,
        family: font.family.trim(),
        source: font.source.trim(),
        fallback: font.fallback.trim(),
        weights: unique(font.weights),
      })),
    platformProfiles: dedupeBy(
      input.platformProfiles
        .filter((profile) => profile.platform.trim().length > 0)
        .map((profile) => ({
          ...profile,
          platform: profile.platform.trim(),
          navigation: profile.navigation.trim(),
          units: profile.units.trim(),
          inputModes: unique(profile.inputModes),
          safeAreas: profile.safeAreas.trim(),
          resizing: profile.resizing.trim(),
          adaptiveBehavior: profile.adaptiveBehavior.trim(),
        })),
      (profile) => profile.platform.toLowerCase(),
    ),
    approvedDependencies: dedupeBy(
      input.approvedDependencies
        .filter((dependency) => dependency.name.trim().length > 0)
        .map((dependency) => ({
          ...dependency,
          name: dependency.name.trim(),
          purpose: dependency.purpose.trim(),
          platforms: unique(dependency.platforms.map((platform) => platform.trim())).filter(Boolean),
        })),
      (dependency) => dependency.name.toLowerCase(),
    ),
    colorTokens: normalizeTokens(input.colorTokens),
    typographyScale: input.typographyScale
      .filter((token) => token.role.trim().length > 0 && token.size.trim().length > 0)
      .map((token) => ({
        ...token,
        role: token.role.trim(),
        size: token.size.trim(),
        weight: token.weight.trim() || "400",
        lineHeight: token.lineHeight.trim() || "1.5",
        usage: token.usage.trim(),
      })),
    spacingScale: normalizeTokens(input.spacingScale),
    radiusTokens: normalizeTokens(input.radiusTokens),
    shadowTokens: normalizeTokens(input.shadowTokens),
    layout: {
      shell: input.layout.shell.trim(),
      navigation: input.layout.navigation.trim(),
      grid: input.layout.grid.trim(),
      breakpoints: input.layout.breakpoints
        .filter((breakpoint) => breakpoint.name.trim().length > 0)
        .map((breakpoint) => ({
          name: breakpoint.name.trim(),
          width: breakpoint.width.trim() || "—",
          behavior: breakpoint.behavior.trim(),
        })),
    },
    components,
    screens,
    interactionRules: unique(input.interactionRules),
    accessibilityRules: unique(input.accessibilityRules),
    contentRules: unique(input.contentRules),
    antiPatterns: unique(input.antiPatterns),
    visualQaRules: unique(input.visualQaRules),
  };
}

export function normalizeAssetPlan(input: AssetPlanSpec, uiDesign: UiDesignSpec | null): AssetPlanSpec {
  void uiDesign;
  const sources = dedupeBy(
    input.sources
      .filter((source) => source.id.trim().length > 0)
      .map((source) => ({
        ...source,
        id: source.id.trim(),
        name: source.name.trim(),
        officialUrl: source.officialUrl.trim(),
        assetTypes: unique(source.assetTypes.map((type) => type.trim())).filter(Boolean),
        license: source.license.trim(),
        platformRestrictions: unique(
          source.platformRestrictions.map((restriction) => restriction.trim()),
        ).filter(Boolean),
      })),
    (source) => source.id.toLowerCase(),
  );
  const usedAssetIds = new Set<string>();

  const assets = dedupeBy(
    input.assets
      .filter((asset) => asset.id.trim().length > 0)
      .map((asset, index) => ({
        ...asset,
        id: uniqueId(slugId(asset.id, `asset-${index + 1}`), usedAssetIds, `asset-${index + 1}`),
        type: asset.type.trim(),
        purpose: asset.purpose.trim(),
        // Preserve unknown screenIds/sourceIds so validators flag them.
        screenIds: unique(asset.screenIds.map((id) => id.trim()).filter(Boolean)),
        placement: asset.placement.trim(),
        sourceMethod: asset.sourceMethod.trim(),
        sourceId: asset.sourceId.trim(),
        query: asset.query.trim(),
        destinationPath: asset.destinationPath.trim(),
        format: asset.format.trim(),
        dimensions: asset.dimensions.trim(),
        aspectRatio: asset.aspectRatio.trim(),
        treatment: asset.treatment.trim(),
        altText: asset.altText.trim(),
        fallback: asset.fallback.trim(),
        platformVariants: unique(asset.platformVariants),
        license: asset.license.trim(),
        attribution: asset.attribution.trim(),
      })),
    (asset) => asset.id.toLowerCase(),
  );

  return {
    strategy: input.strategy.trim(),
    sourcePolicy: {
      rationale: input.sourcePolicy.rationale.trim(),
      freeOnly: input.sourcePolicy.freeOnly,
      legalOnly: input.sourcePolicy.legalOnly,
      localOnly: input.sourcePolicy.localOnly,
    },
    iconSystems: dedupeBy(
      input.iconSystems
        .filter((system) => system.platform.trim().length > 0 && system.family.trim().length > 0)
        .map((system) => ({
          ...system,
          platform: system.platform.trim(),
          family: system.family.trim(),
          size: system.size.trim(),
          stroke: system.stroke.trim(),
          fill: system.fill.trim(),
          opticalAlignment: system.opticalAlignment.trim(),
          color: system.color.trim(),
          accessibility: system.accessibility.trim(),
          mappings: dedupeBy(
            system.mappings
              .filter((mapping) => mapping.action.trim().length > 0 && mapping.icon.trim().length > 0)
              .map((mapping) => ({ action: mapping.action.trim(), icon: mapping.icon.trim() })),
            (mapping) => mapping.action.toLowerCase(),
          ),
        })),
      (system) => system.platform.toLowerCase(),
    ),
    sources,
    assets,
  };
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
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
