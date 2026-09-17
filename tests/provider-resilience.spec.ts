import { expect, test } from "@playwright/test";
import { callModel, type ProviderConfig } from "../src/lib/ai/provider";
import { runTasksBatched } from "../src/lib/pipeline/run";
import type { FeatureSpec, ProjectDefinition, ProjectRecord } from "../src/lib/schemas";

const config: ProviderConfig = {
  baseUrl: "https://provider.invalid/v1",
  apiKey: "test-key",
  model: "primary",
  mode: "live",
};

function unavailableResponse(waitSeconds: number) {
  return new Response(
    JSON.stringify({ error: { message: `[provider] Unavailable (reset after ${waitSeconds}s)` } }),
    { status: 503, headers: { "retry-after": String(waitSeconds) } },
  );
}

function answerResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function withFetch<T>(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("a long retry-after fails fast instead of retrying the request", async () => {
  let calls = 0;
  const error = await withFetch(
    async () => {
      calls += 1;
      return unavailableResponse(831);
    },
    () => callModel(config, { system: "system", user: "user" }).catch((thrown) => thrown),
  );

  expect(calls).toBe(1);
  expect(error.code).toBe("provider-unavailable");
  expect(error.httpStatus).toBe(503);
  expect(String(error.message)).toContain("13 menit");
  expect(String(error.message)).toContain("primary");
});

test("an unavailable primary model falls back to the next model", async () => {
  const requested: string[] = [];
  const result = await withFetch(
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      requested.push(body.model);
      if (body.model === "primary") return unavailableResponse(831);
      return answerResponse('{"ok":true}');
    },
    () => callModel({ ...config, fallbackModels: ["first"] }, { system: "system", user: "user" }),
  );

  expect(requested).toEqual(["primary", "first"]);
  expect(result.model).toBe("first");
  expect(result.content).toBe('{"ok":true}');
});

test("a short retryable failure is still retried before giving up", async () => {
  let calls = 0;
  const error = await withFetch(
    async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
    },
    () => callModel(config, { system: "system", user: "user" }).catch((thrown) => thrown),
  );

  expect(calls).toBe(2);
  expect(error.httpStatus).toBe(500);
});

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

const features: FeatureSpec[] = ["catalog", "sync"].map((id) => ({
  id, prefix: id.toUpperCase(), name: id, purpose: `${id} purpose`, actors: [],
  mainFlow: [], requirements: [{ id: `${id.toUpperCase()}-001`, text: `Do ${id}` }],
  businessRules: [], edgeCases: [], acceptanceCriteria: [],
  userFacing: true, uiSurfaces: [], mediaRequirements: [],
}));

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

test("stops the remaining task batches once the provider is unavailable", async () => {
  const batches: string[] = [];
  const error = await withFetch(
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { batch?: { label?: string } };
      batches.push(body.batch?.label ?? "unknown");
      return new Response(
        JSON.stringify({ error: "Provider AI tidak tersedia…", code: "provider-unavailable" }),
        { status: 503 },
      );
    },
    () => runTasksBatched(project(), liveConfig, {}).catch((thrown) => thrown),
  );

  // Two batches may already be in flight, but the remaining ones are skipped.
  expect(batches.length).toBeLessThanOrEqual(2);
  expect(String(error.message)).toContain("tidak tersedia");
  expect(error.code).toBe("provider-unavailable");
});

test("keeps the tasks that landed before the provider went unavailable", async () => {
  let calls = 0;
  const published: number[] = [];
  const result = await withFetch(
    async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            tasks: [{
              id: "TASK-001", title: "Foundation", type: "foundation", phase: "Project Foundation",
              featureId: "", dependencies: [], references: [], contextDocs: [],
              requirements: ["Set up the project."], uiStates: [], screenIds: [], assetIds: [],
              acceptanceCriteria: ["The project builds."], optional: false,
            }],
            warnings: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Provider AI tidak tersedia…", code: "provider-unavailable" }),
        { status: 503 },
      );
    },
    () =>
      runTasksBatched(project(), liveConfig, {
        onTasksBatch: async (partial) => {
          published.push(partial.length);
        },
      }),
  );

  expect(result.status).toBe("ready");
  expect(result.patch.tasks).toHaveLength(1);
  expect(result.warnings.some((warning) => warning.includes("dilewati"))).toBe(true);
  expect(published[published.length - 1]).toBe(1);
});
