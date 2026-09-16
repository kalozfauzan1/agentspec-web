import type { ApiSpec, FeatureSpec, ImplementationTask } from "@/lib/schemas";

export interface RequirementCoverage {
  requirement: string;
  featureId: string;
  covered_by_tasks: string[];
  covered_by_api: string[];
  covered_by_domain_operation: string[];
  status: "covered" | "uncovered";
}

/**
 * Requirement → Flow → API/Domain operation → Task chain.
 * Every functional requirement must have at least one implementation task.
 */
export function computeRequirementCoverage(input: {
  features: FeatureSpec[];
  tasks: ImplementationTask[];
  api: ApiSpec | null;
}): RequirementCoverage[] {
  const taskRefs = new Map<string, string[]>();
  const taskApiOps = new Map<string, string[]>();
  for (const task of input.tasks) {
    for (const ref of task.references) {
      const key = ref.toUpperCase().trim();
      taskRefs.set(key, [...(taskRefs.get(key) ?? []), task.id]);
    }
    for (const op of task.apiOperations ?? []) {
      taskApiOps.set(op, [...(taskApiOps.get(op) ?? []), task.id]);
    }
  }

  const apiByRequirement = new Map<string, string[]>();
  for (const endpoint of input.api?.endpoints ?? []) {
    const opId = endpoint.operationId?.trim() || endpoint.id;
    for (const reqId of endpoint.requirementIds ?? []) {
      const key = reqId.toUpperCase().trim();
      apiByRequirement.set(key, [...(apiByRequirement.get(key) ?? []), opId]);
    }
    // Fallback: feature-level linkage counts as weak API coverage.
    if ((endpoint.requirementIds ?? []).length === 0 && endpoint.featureId) {
      const marker = `feature:${endpoint.featureId}`;
      apiByRequirement.set(marker, [...(apiByRequirement.get(marker) ?? []), opId]);
    }
  }

  const result: RequirementCoverage[] = [];
  for (const feature of input.features) {
    for (const req of feature.requirements) {
      const key = req.id.toUpperCase().trim();
      const tasks = taskRefs.get(key) ?? [];
      const apiOps =
        apiByRequirement.get(key) ??
        apiByRequirement.get(`feature:${feature.id}`) ??
        [];
      result.push({
        requirement: req.id,
        featureId: feature.id,
        covered_by_tasks: tasks,
        covered_by_api: apiOps,
        covered_by_domain_operation: [],
        status: tasks.length > 0 ? "covered" : "uncovered",
      });
    }
  }
  return result;
}
