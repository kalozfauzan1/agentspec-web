import { expect, test } from "@playwright/test";
import { demoUiDesign } from "../src/lib/ai/demo";
import { runStep } from "../src/lib/ai/steps";
import type { FeatureSpec, ProjectDefinition } from "../src/lib/schemas";

const definition: ProjectDefinition = {
  name: "Team Tasks",
  summary: "A collaborative task tracker.",
  platform: ["web"],
  users: ["team members"],
  roles: [],
  features: Array.from({ length: 8 }, (_, index) => ({
    name: `Feature ${index + 1}`,
    description: `Feature ${index + 1} description`,
  })),
  requirements: [],
  businessRules: [],
  constraints: [],
  nonGoals: [],
  integrations: [],
  technicalPreferences: [],
  visualDirection: {
    style: "",
    themeMode: "",
    references: [],
    notes: "",
    personality: "",
    audienceContext: "",
    desiredEmotion: "",
    informationDensity: "",
    mediaPreferences: [],
    brandConstraints: [],
    avoidPatterns: [],
  },
  implementation: { strategy: "frontend-first" },
};

const features: FeatureSpec[] = definition.features.map((feature, index) => ({
  id: `feature-${index + 1}`,
  prefix: `F${index + 1}`,
  name: feature.name,
  purpose: feature.description,
  actors: [],
  mainFlow: [],
  requirements: [{ id: `F${index + 1}-001`, text: `Implement ${feature.name}` }],
  businessRules: [],
  edgeCases: [],
  acceptanceCriteria: [],
  userFacing: true,
  uiSurfaces: [],
  mediaRequirements: [],
}));

const SCREEN_ID = "team-task-workspace";
const ASSET_ID = "asset-feature-1-empty-state";
const SCREEN_TASK_TITLE = "Build the team task workspace screen";
const baseUiDesign = demoUiDesign(definition, features);
const uiDesign = {
  ...baseUiDesign,
  screens: [
    {
      id: SCREEN_ID,
      name: "Team task workspace",
      featureId: features[0].id,
      purpose: "Review and update the team's active work.",
      layout: ["Workspace heading", "Active task board", "Task detail panel"],
      components: ["PageHeader", "Card"],
      states: ["loading", "populated", "empty", "error"],
      responsive: ["Collapse the detail panel below the task board on narrow screens."],
      sampleContent: ["Prepare release notes — in progress — assigned to Maya"],
      assetIds: [ASSET_ID],
    },
  ],
};
const assetPlan = {
  strategy: "Use local assets only where they clarify a documented screen state.",
  iconSystems: [],
  sources: [],
  assets: [
    {
      id: ASSET_ID,
      screenIds: [SCREEN_ID],
      destinationPath: "public/assets/feature-1-empty-state.svg",
    },
  ],
};

interface TaskBatchScope {
  phases: string[];
  featureIds: string[];
}

function structuredBatchScope(prompt: string): TaskBatchScope | null {
  const marker = /(?:^|\n)TASK_BATCH_SCOPE_JSON ([^\n]+)(?:\n|$)/.exec(prompt)?.[1];
  if (!marker) return null;
  let parsed: Partial<TaskBatchScope>;
  try {
    parsed = JSON.parse(marker) as Partial<TaskBatchScope>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.phases) || !Array.isArray(parsed.featureIds)) return null;
  if (![...parsed.phases, ...parsed.featureIds].every((value) => typeof value === "string")) {
    return null;
  }
  return { phases: parsed.phases, featureIds: parsed.featureIds };
}

function legacyBatchScope(prompt: string): TaskBatchScope {
  const phaseLine = /Cover ONLY these phases: ([^\n]+)\./.exec(prompt)?.[1] ?? "";
  const phases = Array.from(phaseLine.matchAll(/"([^"]+)"/g), (match) => match[1]);
  const knownFeatureIds = new Set(features.map((feature) => feature.id));
  const featureIds = Array.from(
    new Set(
      Array.from(prompt.matchAll(/"id"\s*:\s*"([^"]+)"/g), (match) => match[1]).filter(
        (id) => knownFeatureIds.has(id),
      ),
    ),
  );
  return { phases, featureIds };
}

interface CapturedPrompt {
  content: string;
  scope: TaskBatchScope;
  structuredScope: TaskBatchScope | null;
}

interface RequestEvent {
  scope: "independent" | "integration";
  start: number;
  end: number;
}

interface OverlapBarrier {
  enter: () => Promise<void>;
  reached: Promise<void>;
  release: () => void;
  maxActive: () => number;
}

function createSequence() {
  let value = 0;
  return () => value++;
}

function createOverlapBarrier(required: number): OverlapBarrier {
  let active = 0;
  let maximum = 0;
  let markReached!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => {
    markReached = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async enter() {
      active += 1;
      maximum = Math.max(maximum, active);
      if (active >= required) markReached();
      await released;
      active -= 1;
    },
    reached,
    release,
    maxActive: () => maximum,
  };
}

function providerResponse(options: {
  capturedPrompts?: CapturedPrompt[];
  barrier?: OverlapBarrier;
  events?: RequestEvent[];
  tick?: () => number;
} = {}) {
  return async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const content = body.messages.map((message) => message.content).join("\n");
    const userPrompt = body.messages[1]?.content ?? "";
    const structuredScope = structuredBatchScope(userPrompt);
    const scope = structuredScope ?? legacyBatchScope(userPrompt);
    const phase = scope.phases[0] ?? "Project Foundation";
    const featureId = scope.featureIds[0] ?? "";
    const isIntegrationBatch =
      scope.phases.includes("Integration") || scope.phases.includes("Testing & Validation");
    options.capturedPrompts?.push({ content, scope, structuredScope });
    const event: RequestEvent | null = options.events
      ? { scope: isIntegrationBatch ? "integration" : "independent", start: options.tick?.() ?? 0, end: -1 }
      : null;
    if (event) options.events!.push(event);
    if (!isIntegrationBatch) await options.barrier?.enter();
    if (event) event.end = options.tick?.() ?? 0;
    const isRelevantScreenBatch = phase === "Frontend Features" && featureId === features[0].id;
    const tasks = [
      {
        id: "TASK-001",
        title: `${phase} setup`,
        type: phase.includes("Backend") ? "backend" : "frontend",
        phase,
        featureId,
        dependencies: [],
        references: [],
        contextDocs: [],
        requirements: ["Create the setup."],
        uiStates: [],
        acceptanceCriteria: ["The setup exists."],
        optional: false,
      },
      {
        id: "TASK-002",
        title: isRelevantScreenBatch ? SCREEN_TASK_TITLE : `${phase} implementation`,
        type: phase.includes("Backend") ? "backend" : "frontend",
        phase,
        featureId,
        dependencies: ["TASK-001"],
        references: [],
        contextDocs: [],
        requirements: ["Implement the feature."],
        uiStates: [],
        ...(isRelevantScreenBatch ? { screenIds: [SCREEN_ID], assetIds: [ASSET_ID] } : {}),
        acceptanceCriteria: ["The feature works."],
        optional: false,
      },
    ];

    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ tasks }) }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

async function generateTasks(options: {
  capturedPrompts?: CapturedPrompt[];
  barrier?: OverlapBarrier;
  events?: RequestEvent[];
  tick?: () => number;
} = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = providerResponse(options) as typeof fetch;
  try {
    const request = { definition, features, architecture: null, uiDesign, assetPlan: assetPlan as never } as unknown as Parameters<
      typeof runStep
    >[1];
    return await runStep("tasks", request, {
      baseUrl: "https://provider.invalid/v1",
      apiKey: "test-key",
      model: "test-model",
      mode: "live",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("keeps every dependency attached to an earlier task from its originating batch", async () => {
  const result = await generateTasks();
  const tasks = (result.payload as {
    tasks: { id: string; phase: string; featureId: string; dependencies: string[] }[];
  }).tasks;
  const byId = new Map(tasks.map((task, index) => [task.id, { task, index }]));

  expect(byId.size).toBe(tasks.length);
  for (const [index, task] of tasks.entries()) {
    expect(Array.isArray(task.dependencies)).toBe(true);
    for (const dependencyId of task.dependencies) {
      const dependency = byId.get(dependencyId);
      expect(dependency, `${task.id} has unknown dependency ${dependencyId}`).toBeDefined();
      if (!dependency) continue;
      expect(dependency.index).toBeLessThan(index);
      expect(dependency.task.phase).toBe(task.phase);
      expect(dependency.task.featureId).toBe(task.featureId);
    }
  }
});

test("runs independent task batches concurrently before integration", async () => {
  const barrier = createOverlapBarrier(2);
  const events: RequestEvent[] = [];
  const tick = createSequence();
  const generation = generateTasks({ barrier, events, tick });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const overlapped = await Promise.race([
    barrier.reached.then(() => true),
    new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), 1_000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  barrier.release();
  await generation;

  const independent = events.filter((event) => event.scope === "independent");
  const integration = events.filter((event) => event.scope === "integration");

  expect(overlapped).toBe(true);
  expect(independent.length).toBeGreaterThanOrEqual(2);
  expect(barrier.maxActive()).toBeGreaterThanOrEqual(2);
  expect(integration.length).toBeGreaterThan(0);
  if (integration.length > 0 && independent.length > 0) {
    const firstIntegrationStart = Math.min(...integration.map((event) => event.start));
    const lastIndependentEnd = Math.max(...independent.map((event) => event.end));
    expect(firstIntegrationStart).toBeGreaterThan(lastIndependentEnd);
  }
});

test("task prompts expose a machine-readable batch scope", async () => {
  const prompts: CapturedPrompt[] = [];
  await generateTasks({ capturedPrompts: prompts });

  expect(prompts.length).toBeGreaterThan(0);
  for (const prompt of prompts) {
    expect(prompt.structuredScope, "missing TASK_BATCH_SCOPE_JSON marker").not.toBeNull();
    if (!prompt.structuredScope) continue;
    expect(prompt.structuredScope.phases.length).toBeGreaterThan(0);
    expect(Array.isArray(prompt.structuredScope.featureIds)).toBe(true);
  }
});

test("task prompts receive concrete UI screen ids", async () => {
  const prompts: CapturedPrompt[] = [];
  await generateTasks({ capturedPrompts: prompts });
  const prompt = prompts.find(
    (entry) =>
      entry.scope.phases.includes("Frontend Features") &&
      entry.scope.featureIds.includes(features[0].id),
  );

  expect(prompt, "missing the frontend prompt scoped to the screen's feature").toBeDefined();
  if (!prompt) return;
  expect(prompt.content.includes(SCREEN_ID)).toBe(true);
});

test("task prompts receive concrete asset ids", async () => {
  const prompts: CapturedPrompt[] = [];
  await generateTasks({ capturedPrompts: prompts });
  const prompt = prompts.find(
    (entry) =>
      entry.scope.phases.includes("Frontend Features") &&
      entry.scope.featureIds.includes(features[0].id),
  );

  expect(prompt, "missing the frontend prompt scoped to the asset's feature").toBeDefined();
  if (!prompt) return;
  expect(prompt.content.includes(ASSET_ID)).toBe(true);
});

test("generated tasks preserve concrete UI screen ids", async () => {
  const result = await generateTasks();
  const tasks = (result.payload as {
    tasks: { title: string; type: string; featureId: string; screenIds?: string[]; assetIds?: string[] }[];
  }).tasks;
  const screenTask = tasks.find(
    (task) =>
      task.title === SCREEN_TASK_TITLE &&
      task.type === "frontend" &&
      task.featureId === features[0].id,
  );

  expect(screenTask, "the relevant frontend screen task must be generated").toBeDefined();
  expect(screenTask!.screenIds).toEqual([SCREEN_ID]);
});

test("generated tasks preserve concrete asset ids", async () => {
  const result = await generateTasks();
  const tasks = (result.payload as {
    tasks: { title: string; type: string; featureId: string; screenIds?: string[]; assetIds?: string[] }[];
  }).tasks;
  const screenTask = tasks.find(
    (task) =>
      task.title === SCREEN_TASK_TITLE &&
      task.type === "frontend" &&
      task.featureId === features[0].id,
  );

  expect(screenTask, "the relevant frontend screen task must be generated").toBeDefined();
  expect(screenTask!.assetIds).toEqual([ASSET_ID]);
});
