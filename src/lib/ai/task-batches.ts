import type { FeatureSpec, ImplementationTask, ProjectDefinition } from "@/lib/schemas";

export interface TaskBatch {
  label: string;
  phases: string[];
  features: FeatureSpec[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches.length > 0 ? batches : [[]];
}

/**
 * Execution plan for task generation. Stages run sequentially; batches
 * inside one stage are independent and may run with bounded concurrency.
 * The final stage (integration & validation) must run last because it
 * needs to see every task created before it.
 */
export function taskBatchStages(
  definition: ProjectDefinition,
  features: FeatureSpec[],
): TaskBatch[][] {
  if (definition.implementation.strategy === "module-first") {
    const planning: TaskBatch[] = [
      { label: "Foundation", phases: ["Foundation"], features: [] },
      ...features.map((feature) => ({
        label: `${feature.name} module`,
        phases: [feature.name],
        features: [feature],
      })),
    ];
    return [
      ...chunk(planning, 6),
      [{ label: "Integration and validation", phases: ["Integration", "Testing & Validation"], features }],
    ];
  }

  const groups = chunk(features, 4);
  const planning: TaskBatch[] = [
    {
      label: "Project and frontend foundation",
      phases: ["Project Foundation", "Frontend Foundation"],
      features: [],
    },
    ...groups.map((group, index) => ({
      label: `Frontend features (part ${index + 1} of ${groups.length})`,
      phases: ["Frontend Features"],
      features: group,
    })),
    { label: "Backend foundation", phases: ["Backend Foundation"], features: [] },
    ...groups.map((group, index) => ({
      label: `Backend features (part ${index + 1} of ${groups.length})`,
      phases: ["Backend Features"],
      features: group,
    })),
  ];

  return [
    ...chunk(planning, 6),
    [{
      label: "Frontend completion, integration and validation",
      phases: ["Frontend Completion", "Integration", "Testing & Validation"],
      features,
    }],
  ];
}

/**
 * Batching means task ids can collide or drift between calls. Every id becomes
 * TASK-###, duplicates are renumbered, and dependencies that pointed at a
 * duplicated id keep pointing at the first task that owned it.
 */
export function rebaseTaskIds(tasks: ImplementationTask[], start: number): ImplementationTask[] {
  const format = (value: number) => `TASK-${String(value).padStart(3, "0")}`;
  const idMap = new Map<string, string>();

  tasks.forEach((task, index) => {
    const raw = task.id.toUpperCase().trim();
    if (!idMap.has(raw)) idMap.set(raw, format(start + index));
  });

  return tasks.map((task, index) => ({
    ...task,
    id: format(start + index),
    dependencies: task.dependencies.map((dependency) => (
      idMap.get(dependency.toUpperCase().trim()) ?? dependency
    )),
  }));
}
