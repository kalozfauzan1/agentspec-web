import type { ImplementationTask } from "@/lib/schemas";

export interface DagValidation {
  unknownDependencies: { taskId: string; dependency: string }[];
  cycles: string[][];
  hasCycle: boolean;
  topologicalOrder: string[];
}

/** Explicit DAG validation: refs exist, graph is acyclic, order is valid. */
export function validateTaskGraph(tasks: ImplementationTask[]): DagValidation {
  const ids = new Set(tasks.map((task) => task.id));
  const unknownDependencies: DagValidation["unknownDependencies"] = [];
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    const deps: string[] = [];
    for (const raw of task.dependencies) {
      const dep = raw.toUpperCase().trim();
      if (!dep) continue;
      if (dep === task.id) {
        unknownDependencies.push({ taskId: task.id, dependency: dep });
        continue;
      }
      if (!ids.has(dep)) {
        unknownDependencies.push({ taskId: task.id, dependency: dep });
        continue;
      }
      deps.push(dep);
    }
    adjacency.set(task.id, deps);
  }

  // Kahn's algorithm for cycle detection + topological order.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const task of tasks) {
    indegree.set(task.id, 0);
    dependents.set(task.id, []);
  }
  for (const [id, deps] of adjacency) {
    indegree.set(id, deps.length);
    for (const dep of deps) {
      dependents.set(dep, [...(dependents.get(dep) ?? []), id]);
    }
  }

  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const dependent of dependents.get(current) ?? []) {
      indegree.set(dependent, (indegree.get(dependent) ?? 0) - 1);
      if (indegree.get(dependent) === 0) queue.push(dependent);
    }
  }

  const hasCycle = order.length !== tasks.length;
  const cycles: string[][] = [];
  if (hasCycle) {
    const remaining = tasks.map((t) => t.id).filter((id) => !order.includes(id));
    if (remaining.length > 0) cycles.push(remaining);
  }

  return { unknownDependencies, cycles, hasCycle, topologicalOrder: order };
}

/** Foundational tasks (mock infra, backend foundation) must precede consumers. */
export function findMissingFoundationalDeps(tasks: ImplementationTask[]): string[] {
  const problems: string[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const hasInfra = tasks.some((t) =>
    /mock|infrastructure|foundation|design token|component primitive/i.test(t.title),
  );
  if (!hasInfra) return problems;

  for (const task of tasks) {
    const needsInfra =
      task.type === "frontend" ||
      task.type === "backend" ||
      task.type === "integration" ||
      /mock|postgres|redis|auth|tenant|nest/i.test(
        [...task.requirements, ...task.implementationNotes ?? []].join(" "),
      );
    if (needsInfra && task.dependencies.length === 0 && task.type !== "foundation") {
      const firstFoundation = tasks.find(
        (t) => t.type === "foundation" && t.id !== task.id,
      );
      if (firstFoundation && byId.has(firstFoundation.id)) {
        problems.push(`${task.id} runnable before required infrastructure ${firstFoundation.id}`);
      }
    }
  }
  return problems.slice(0, 10);
}
