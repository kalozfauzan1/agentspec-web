import { expect, test } from "@playwright/test";
import { z } from "zod";
import { parseWithSchema } from "../src/lib/ai/parse";
import { runStep } from "../src/lib/ai/steps";
import type { FeatureSpec, ImplementationTask } from "../src/lib/schemas";

const liveConfig = {
  baseUrl: "https://provider.invalid/v1",
  apiKey: "test-key",
  model: "test-model",
  mode: "live" as const,
};

function feature(id: string, name: string, purpose: string): FeatureSpec {
  return {
    id,
    prefix: id.slice(0, 4).toUpperCase(),
    name,
    purpose,
    actors: [],
    mainFlow: [],
    requirements: [],
    businessRules: [],
    edgeCases: [],
    acceptanceCriteria: [],
    userFacing: true,
    uiSurfaces: [],
    mediaRequirements: [],
  };
}

function task(
  id: string,
  title: string,
  type: ImplementationTask["type"] = "frontend",
  phase = "Frontend Features",
): ImplementationTask {
  return {
    id,
    title,
    type,
    phase,
    featureId: "",
    dependencies: [],
    references: [],
    contextDocs: [],
    requirements: [],
    uiStates: [],
    screenIds: [],
    assetIds: [],
    acceptanceCriteria: [],
    optional: false,
  };
}

function answerResponse(content: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] }),
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

test("feature edit uses a delta and preserves untouched features in place", async () => {
  const current = [
    {
      ...feature("catalog", "Catalog", "Original catalog purpose"),
      actors: ["seller"],
      mainFlow: ["Seller opens the catalog."],
      requirements: [{ id: "CATA-001", text: "Seller can browse products." }],
      businessRules: ["Only active products are visible."],
      edgeCases: ["The catalog is empty."],
      acceptanceCriteria: ["The catalog keeps its product rules."],
      uiSurfaces: [{ id: "catalog-page", name: "Catalog", purpose: "Browse products", states: ["ready"] }],
      mediaRequirements: ["Product thumbnails"],
    },
    feature("checkout", "Checkout", "Original checkout purpose"),
  ];
  let systemPrompt = "";

  const result = await withFetch(
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      systemPrompt = body.messages.find((message) => message.role === "system")?.content ?? "";
      return answerResponse(JSON.stringify({
        summary: "Tujuan katalog diperbarui.",
        affected: [],
        featureChanges: {
          upsert: [{ id: "Catalog", purpose: "Updated catalog purpose" }],
          removeIds: [],
        },
      }));
    },
    () => runStep("edit", {
      target: "features",
      instruction: "Update the catalog purpose.",
      features: current,
    }, liveConfig),
  );

  const patch = result.payload as { patch: { features: FeatureSpec[] }; affected: string[] };
  expect(patch.patch.features.map(({ id, purpose }) => ({ id, purpose }))).toEqual([
    { id: "catalog", purpose: "Updated catalog purpose" },
    { id: "checkout", purpose: "Original checkout purpose" },
  ]);
  expect(patch.patch.features[0]).toMatchObject({
    id: "catalog",
    name: "Catalog",
    prefix: "CATA",
    actors: ["seller"],
    mainFlow: ["Seller opens the catalog."],
    requirements: [{ id: "CATA-001", text: "Seller can browse products." }],
    businessRules: ["Only active products are visible."],
    edgeCases: ["The catalog is empty."],
    acceptanceCriteria: ["The catalog keeps its product rules."],
    uiSurfaces: [{ id: "catalog-page", name: "Catalog", purpose: "Browse products", states: ["ready"] }],
    mediaRequirements: ["Product thumbnails"],
  });
  expect(patch.affected).toContain("tasks");
  expect(systemPrompt).toContain('"featureChanges"');
  expect(systemPrompt).toContain('"upsert"');
  expect(systemPrompt).toContain('"removeIds"');
  expect(systemPrompt).toContain("omit unchanged");
  expect(systemPrompt).not.toContain("Return the FULL list of features");
});

test("task delta updates, removes, and appends while preserving untouched task order and IDs", async () => {
  const current = [
    {
      ...task("TASK-001", "Set up project", "foundation", "Project Foundation"),
      goal: "Create the shared foundation.",
      references: ["CATA-001"],
      contextDocs: ["docs/architecture.md"],
      requirements: ["Configure the application shell."],
      implementationNotes: ["Keep setup deterministic."],
      acceptanceCriteria: ["The application starts locally."],
      validationCommands: ["npm run typecheck"],
    },
    task("TASK-002", "Build obsolete screen"),
    task("TASK-003", "Build checkout screen"),
  ];

  const result = await withFetch(
    async () => answerResponse(JSON.stringify({
      summary: "Daftar tugas diperbarui.",
      affected: [],
      taskChanges: {
        upsert: [
          { id: "task-001", title: "Set up application" },
          task("TASK-004", "Test checkout", "testing", "Testing & Validation"),
        ],
        removeIds: ["task-002"],
      },
    })),
    () => runStep("edit", {
      target: "tasks",
      instruction: "Rename setup, remove the obsolete screen, and add checkout tests.",
      tasks: current,
      features: [],
    }, liveConfig),
  );

  const patch = result.payload as { patch: { tasks: ImplementationTask[] } };
  expect(patch.patch.tasks.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: "TASK-001", title: "Set up application" },
    { id: "TASK-003", title: "Build checkout screen" },
    { id: "TASK-004", title: "Test checkout" },
  ]);
  expect(patch.patch.tasks[0]).toMatchObject({
    id: "TASK-001",
    goal: "Create the shared foundation.",
    type: "foundation",
    phase: "Project Foundation",
    references: ["CATA-001"],
    contextDocs: ["docs/architecture.md"],
    requirements: ["Configure the application shell."],
    implementationNotes: ["Keep setup deterministic."],
    acceptanceCriteria: ["The application starts locally."],
    validationCommands: ["npm run typecheck"],
  });
});

test("malformed feature edit retries with the same target-aware output budget", async () => {
  const current = [feature("catalog", "Catalog", "Original purpose")];
  const requestBodies: Array<{ max_tokens: number }> = [];

  const result = await withFetch(
    async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as { max_tokens: number });
      if (requestBodies.length === 1) return answerResponse('{"featureChanges":', "length");
      return answerResponse(JSON.stringify({
        summary: "Tujuan katalog diperbarui.",
        affected: [],
        featureChanges: {
          upsert: [feature("catalog", "Catalog", "Recovered purpose")],
          removeIds: [],
        },
      }));
    },
    () => runStep("edit", {
      target: "features",
      instruction: "Update the catalog purpose.",
      features: current,
    }, liveConfig),
  );

  const patch = result.payload as { patch: { features: FeatureSpec[] } };
  expect(patch.patch.features[0].purpose).toBe("Recovered purpose");
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies.map((body) => body.max_tokens)).toEqual([24_000, 24_000]);
});

test("two invalid JSON attempts report the retry failure", async () => {
  const error = (await parseWithSchema(z.object({ value: z.string() }), '{"value":', {
    step: "edit",
    repair: async () => "respons kedua tanpa JSON",
  }).catch((thrown) => thrown)) as { code: string; httpStatus: number; message: string };

  expect(error.code).toBe("invalid-json");
  expect(error.httpStatus).toBe(502);
  expect(error.message).toContain("Percobaan pertama");
  expect(error.message).toContain("JSON dari model terpotong atau tidak seimbang");
  expect(error.message).toContain("Percobaan ulang");
  expect(error.message).toContain("Respons model tidak mengandung JSON yang bisa dibaca");
});

test("malformed JSON followed by schema-invalid JSON reports invalid-schema", async () => {
  const error = (await parseWithSchema(z.object({ value: z.string() }), '{"value":', {
    step: "edit",
    repair: async () => '{"value":42}',
  }).catch((thrown) => thrown)) as { code: string; httpStatus: number; message: string };

  expect(error.code).toBe("invalid-schema");
  expect(error.httpStatus).toBe(502);
  expect(error.message).toContain("Percobaan pertama");
  expect(error.message).toContain("JSON dari model terpotong atau tidak seimbang");
  expect(error.message).toContain("Percobaan ulang");
  expect(error.message).toContain("value");
});

test("schema-invalid JSON followed by malformed JSON reports both failures", async () => {
  const error = (await parseWithSchema(z.object({ value: z.string() }), '{"value":42}', {
    step: "edit",
    repair: async () => "respons kedua tanpa JSON",
  }).catch((thrown) => thrown)) as { code: string; httpStatus: number; message: string };

  expect(error.code).toBe("invalid-json");
  expect(error.httpStatus).toBe(502);
  expect(error.message).toContain("Percobaan pertama");
  expect(error.message).toContain("value");
  expect(error.message).toContain("Percobaan ulang");
  expect(error.message).toContain("Respons model tidak mengandung JSON yang bisa dibaca");
});

test("feature delta rejects duplicate upsert IDs", async () => {
  const duplicate = {
    summary: "Duplikat.",
    affected: [],
    featureChanges: {
      upsert: [
        feature("Catalog", "Catalog", "First"),
        feature("catalog", "Catalog", "Second"),
      ],
      removeIds: [],
    },
  };

  const error = (await withFetch(
    async () => answerResponse(JSON.stringify(duplicate)),
    () => runStep("edit", {
      target: "features",
      instruction: "Update catalog.",
      features: [feature("catalog", "Catalog", "Original")],
    }, liveConfig).catch((thrown) => thrown),
  )) as { code: string; message: string };

  expect(error.code).toBe("invalid-schema");
  expect(error.message).toContain("catalog");
});

test("task delta rejects IDs present in both upsert and remove", async () => {
  const overlap = {
    summary: "Konflik.",
    affected: [],
    taskChanges: {
      upsert: [task("task-001", "Changed")],
      removeIds: ["TASK-001"],
    },
  };

  const error = (await withFetch(
    async () => answerResponse(JSON.stringify(overlap)),
    () => runStep("edit", {
      target: "tasks",
      instruction: "Change tasks.",
      tasks: [task("TASK-001", "Original")],
      features: [],
    }, liveConfig).catch((thrown) => thrown),
  )) as { code: string; message: string };

  expect(error.code).toBe("invalid-schema");
  expect(error.message).toContain("TASK-001");
});

test("task delta rejects unknown removal IDs", async () => {
  const error = (await withFetch(
    async () => answerResponse(JSON.stringify({
      summary: "Hapus tugas.",
      affected: [],
      taskChanges: { upsert: [], removeIds: ["task-999"] },
    })),
    () => runStep("edit", {
      target: "tasks",
      instruction: "Remove task 999.",
      tasks: [task("TASK-001", "Original")],
      features: [],
    }, liveConfig).catch((thrown) => thrown),
  )) as { code: string; httpStatus: number; message: string };

  expect(error.code).toBe("invalid-edit-delta");
  expect(error.httpStatus).toBe(502);
  expect(error.message).toContain("task-999");
  expect(error.message).toContain("tidak ditemukan");
});
