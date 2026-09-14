import { expect, test } from "@playwright/test";
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
}));

function providerResponse(delayMs = 0) {
  return async (_input: string | URL | Request, init?: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const scope = /Cover ONLY these phases: ([^\n]+)\./.exec(body.messages[0]?.content ?? body.messages[1]?.content ?? "")
      ?? /Cover ONLY these phases: ([^\n]+)\./.exec(body.messages[1]?.content ?? "");
    const phase = /"([^"]+)"/.exec(scope?.[1] ?? "")?.[1] ?? "Project Foundation";
    const featureId = /"id": "([^"]+)"/.exec(body.messages[1]?.content ?? "")?.[1] ?? "";
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
        title: `${phase} implementation`,
        type: phase.includes("Backend") ? "backend" : "frontend",
        phase,
        featureId,
        dependencies: ["TASK-001"],
        references: [],
        contextDocs: [],
        requirements: ["Implement the feature."],
        uiStates: [],
        acceptanceCriteria: ["The feature works."],
        optional: false,
      },
    ];

    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ tasks }) }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

async function generateTasks(delayMs = 0) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = providerResponse(delayMs) as typeof fetch;
  try {
    return await runStep("tasks", { definition, features, architecture: null }, {
      baseUrl: "https://provider.invalid/v1",
      apiKey: "test-key",
      model: "test-model",
      mode: "live",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("keeps dependencies within their originating task batch", async () => {
  const result = await generateTasks();
  const tasks = (result.payload as { tasks: { id: string; dependencies: string[] }[] }).tasks;

  expect(tasks).toHaveLength(14);
  for (let index = 1; index < tasks.length; index += 2) {
    expect(tasks[index].dependencies).toEqual([tasks[index - 1].id]);
  }
});

test("runs independent task batches concurrently before integration", async () => {
  const started = performance.now();
  await generateTasks(100);
  const elapsed = performance.now() - started;

  expect(elapsed).toBeLessThan(450);
});
