import type {
  ApiSpec,
  CanonicalApiOperation,
  CanonicalRequirement,
  CanonicalSpec,
  DataModelSpec,
  FeatureSpec,
  UiDesignSpec,
} from "@/lib/schemas";

function slugOperationId(method: string, path: string, fallback: string) {
  const slug = `${method.toLowerCase()}-${path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
  return slug.replace(/-+/g, "-") || fallback;
}

/**
 * Canonical registry builder — single source of truth derived from
 * features + data model + API + UI design. Downstream docs must REFER
 * to these identifiers, never redefine them.
 */
export function buildCanonicalSpec(input: {
  features: FeatureSpec[];
  dataModel: DataModelSpec | null;
  api: ApiSpec | null;
  uiDesign: UiDesignSpec | null;
}): CanonicalSpec {
  const requirements: CanonicalRequirement[] = [];
  for (const feature of input.features) {
    for (const req of feature.requirements) {
      requirements.push({
        id: req.id.toUpperCase().trim(),
        title: req.text.slice(0, 80),
        text: req.text,
        featureId: feature.id,
      });
    }
  }

  const entities = (input.dataModel?.entities ?? []).map((entity) => ({
    name: entity.name.trim(),
    fields: entity.fields.map((field) => field.name.trim()),
  }));

  // Enums are harvested from field constraints mentioning "enum" so that
  // UI/API/DB can later be checked against one canonical list.
  const enumMap = new Map<string, Set<string>>();
  for (const entity of input.dataModel?.entities ?? []) {
    for (const field of entity.fields) {
      for (const constraint of field.constraints) {
        const match = /enum\s*:?\s*\[?([^\]]+)\]?/i.exec(constraint);
        if (match) {
          const values = match[1].split(/[,|/]/).map((v) => v.trim().toLowerCase()).filter(Boolean);
          if (values.length > 0) {
            const key = field.name.toLowerCase();
            const set = enumMap.get(key) ?? new Set<string>();
            values.forEach((v) => set.add(v));
            enumMap.set(key, set);
          }
        }
      }
    }
  }
  const enums = [...enumMap].map(([name, values]) => ({ name, values: [...values] }));

  const apiOperations: CanonicalApiOperation[] = (input.api?.endpoints ?? []).map(
    (endpoint, index) => ({
      operationId:
        endpoint.operationId?.trim() ||
        slugOperationId(endpoint.method, endpoint.path, `operation-${index + 1}`),
      method: endpoint.method,
      path: endpoint.path,
      requirementIds: (endpoint.requirementIds ?? []).map((r) => r.toUpperCase().trim()),
      featureId: endpoint.featureId,
    }),
  );

  const screens = (input.uiDesign?.screens ?? []).map((screen) => screen.id);

  return { requirements, entities, enums, stateMachines: [], apiOperations, screens };
}

export function requirementIndex(canonical: CanonicalSpec) {
  return new Map(canonical.requirements.map((req) => [req.id.toUpperCase(), req]));
}

export function entityIndex(canonical: CanonicalSpec) {
  return new Map(canonical.entities.map((entity) => [entity.name.toLowerCase(), entity]));
}

export function apiOperationIndex(canonical: CanonicalSpec) {
  const byId = new Map(canonical.apiOperations.map((op) => [op.operationId, op]));
  const byRoute = new Map(
    canonical.apiOperations.map((op) => [`${op.method} ${op.path.toLowerCase()}`, op]),
  );
  return { byId, byRoute };
}
