import { expect, test } from "@playwright/test";
import { runStep } from "../src/lib/ai/steps";
import { taskBatchStages } from "../src/lib/ai/task-batches";
import { runTasksBatched } from "../src/lib/pipeline/run";
import type { FeatureSpec, ProjectDefinition, ProjectRecord } from "../src/lib/schemas";

const definition: ProjectDefinition = {
  name: "Batched Tasks",
  summary: "Two-feature project for batch isolation.",
  platform: ["web"],
  users: ["seller"],
  roles: [],
  features: [
    { name: "Catalog", description: "Manage products." },
    { name: "Sync", description: "Sync inventory." },
  ],
  requirements: [],
  businessRules: [],
  constraints: [],
  nonGoals: [],
  integrations: [],
  technicalPreferences: [],
  visualDirection: {
    style: "", themeMode: "", references: [], notes: "", personality: "",
    audienceContext: "", desiredEmotion: "", informationDensity: "",
    mediaPreferences: [], brandConstraints: [], avoidPatterns: [],
  },
  implementation: { strategy: "frontend-first" },
};

function feature(id: string, prefix: string, reqId: string, reqText: string): FeatureSpec {
  return {
    id, prefix, name: id, purpose: `${id} purpose`, actors: [],
    mainFlow: [], requirements: [{ id: reqId, text: reqText }],
    businessRules: [], edgeCases: [], acceptanceCriteria: [],
    userFacing: true, uiSurfaces: [], mediaRequirements: [],
  };
}

const features: FeatureSpec[] = [
  feature("catalog", "CAT", "CAT-001", "Seller edits product brand inline"),
  feature("sync", "SYNC", "SYNC-001", "Cancellation releases reserved stock atomically"),
];

function project(): ProjectRecord {
  const now = Date.now();
  return {
    id: "proj-test", idea: "test", status: "generating", createdAt: now, updatedAt: now,
    analysis: null, questions: [], answers: [], definition,
    artifacts: {
      prd: null, features, flows: [], uiDesign: null, assetPlan: null,
      architecture: null, dataModel: null, api: null, tasks: [],
      agentInstructions: null,
      canonical: { requirements: [], entities: [], enums: [], stateMachines: [], apiOperations: [], screens: [] },
    },
    artifactStatus: {} as ProjectRecord["artifactStatus"],
    validation: null, editHistory: [],
  };
}

const liveConfig = {
  baseUrl: "https://provider.invalid/v1",
  apiKey: "test-key",
  model: "test-model",
  mode: "live" as const,
};

test("tasksBatch rejects batches scoped to unknown features", async () => {
  let failed = false;
  try {
    await runStep(
      "tasksBatch",
      { definition, features, batch: { index: 1, total: 2, label: "x", phases: ["Frontend Features"], featureIds: ["ghost"], knownTasks: [], nextTaskNumber: 1 } },
      liveConfig,
    );
  } catch (error) {
    failed = true;
    expect(String((error as Error).message).includes("ghost")).toBe(true);
  }
  expect(failed).toBe(true);
});

test("tasksBatch prompt carries in-scope requirements, not out-of-scope ones", async () => {
  const prompts: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    prompts.push(body.messages.map((message) => message.content).join("\n"));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ tasks: [] }) }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    await runStep(
      "tasksBatch",
      { definition, features, batch: { index: 1, total: 2, label: "catalog batch", phases: ["Frontend Features"], featureIds: ["catalog"], knownTasks: [], nextTaskNumber: 1 } },
      liveConfig,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(prompts.length).toBeGreaterThan(0);
  const prompt = prompts.join("\n");
  expect(prompt.includes("Seller edits product brand inline")).toBe(true);
  expect(prompt.includes("Cancellation releases reserved stock atomically")).toBe(false);
});

test("one failed batch keeps the tasks landed by other batches", async () => {
  const calls = new Map<string, number>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    // callStep posts to /api/ai/tasksBatch; distinguish batches by label.
    const body = JSON.parse(String(init?.body)) as { batch?: { label?: string } };
    const label = body.batch?.label ?? "unknown";
    calls.set(label, (calls.get(label) ?? 0) + 1);
    if (label.includes("Backend foundation")) {
      return new Response(JSON.stringify({ error: "gateway timeout", code: "gateway-timeout" }), { status: 504 });
    }
    const safe = label.replace(/[^a-z0-9]+/gi, "-");
    return new Response(JSON.stringify({
      tasks: [{
        id: "TASK-001", title: `Work ${safe}`, type: "frontend", phase: "Frontend Features",
        featureId: "", dependencies: [], references: [], contextDocs: [],
        requirements: ["Do the work."], uiStates: [], screenIds: [], assetIds: [],
        acceptanceCriteria: ["Given work, When done, Then it exists."],
        optional: false,
      }],
      warnings: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const published: number[] = [];
    const result = await runTasksBatched(project(), { baseUrl: "", apiKey: "", model: "", mode: "live" }, {
      onTasksBatch: async (partial) => {
        published.push(partial.length);
      },
    });

    expect(result.status).toBe("ready");
    expect(result.patch.tasks!.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Backend foundation"))).toBe(true);
    // Partial progress was published before the final result.
    expect(published.length).toBeGreaterThan(0);
    expect(published[published.length - 1]).toBe(result.patch.tasks!.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("integration stage always runs last", () => {
  const stages = taskBatchStages(definition, features);
  const last = stages[stages.length - 1];
  expect(last).toHaveLength(1);
  expect(last[0].label.includes("integration")).toBe(true);
});
