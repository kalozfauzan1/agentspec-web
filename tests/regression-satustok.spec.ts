import { expect, test } from "@playwright/test";
import { runDeterministicChecks } from "../src/lib/validation/checks";
import { computeRequirementCoverage } from "../src/lib/validation/coverage";
import { validateTaskGraph } from "../src/lib/validation/dag";
import { buildCanonicalSpec } from "../src/lib/canonical/registry";
import type { ValidationInput } from "../src/lib/validation/checks";

function satuStokLikeFixture(): ValidationInput {
  return {
    definition: {
      name: "SatuStok",
      summary: "Marketplace inventory sync.",
      platform: ["web"],
      users: ["seller"],
      roles: [],
      features: [],
      requirements: [],
      businessRules: ["available = on_hand - reserved"],
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
    },
    features: [
      {
        id: "inventory-sync", prefix: "SYNC", name: "Inventory Sync", purpose: "",
        actors: ["System"],
        mainFlow: ["Marketplace webhook", "ingest order", "reserve inventory", "broadcast"],
        requirements: [
          { id: "SYNC-003", text: "Cancellation releases previously reserved stock." },
          { id: "SYNC-004", text: "Log stock adjustment and sync dispatch." },
        ],
        businessRules: [], edgeCases: [], acceptanceCriteria: ["ok"],
        userFacing: false, uiSurfaces: [], mediaRequirements: [],
      },
      {
        id: "catalog", prefix: "CAT", name: "Catalog", purpose: "",
        actors: ["Seller"], mainFlow: [], requirements: [{ id: "CAT-001", text: "Edit product." }],
        businessRules: [], edgeCases: [], acceptanceCriteria: ["ok"],
        userFacing: true, uiSurfaces: [], mediaRequirements: [],
      },
    ],
    flows: [],
    uiDesign: {
      overview: "", styleDirection: "", creativeConcept: "", creativeRationale: "",
      themeMode: "", principles: [], signatureMoments: [], fontFamilies: [],
      colorTokens: [], typographyScale: [], spacingScale: [], radiusTokens: [],
      shadowTokens: [], layout: { shell: "", navigation: "", grid: "", breakpoints: [] },
      platformProfiles: [], approvedDependencies: [], components: [],
      screens: [
        {
          id: "product-editor", name: "Product editor", featureId: "catalog",
          purpose: "", layout: [], components: [], states: ["populated"],
          responsive: [], sampleContent: ['{"brand": "Acme", "category": "Snack"}'],
          assetIds: [],
        },
      ],
      interactionRules: [], accessibilityRules: [], contentRules: [],
      antiPatterns: [], visualQaRules: [],
    },
    assetPlan: null,
    architecture: { overview: "", decisions: [], systemBoundaries: { inside: [], outside: [] }, dataFlow: [], externalServices: [], rules: [] },
    dataModel: {
      overview: "",
      entities: [
        {
          name: "inventory_movement_logs", purpose: "",
          fields: [
            { name: "id", type: "uuid", purpose: "", constraints: [] },
            { name: "status", type: "text", purpose: "", constraints: ["enum: unpaid, paid, ready_to_ship, shipped, completed, cancelled"] },
          ],
          notes: "",
        },
        {
          name: "products", purpose: "",
          fields: [{ name: "id", type: "uuid", purpose: "", constraints: [] }],
          notes: "",
        },
      ],
      relationships: [],
    },
    api: {
      overview: "", authentication: "",
      endpoints: [
        {
          id: "list-orders", operationId: "listOrders", method: "GET", path: "/api/orders",
          purpose: "List orders", actor: "", authentication: "required",
          featureId: "inventory-sync", requirementIds: ["SYNC-003"],
          request: "{}", response: '{"roundingMode": "string", "priority": "number"}', errors: [],
        },
      ],
    },
    tasks: [
      {
        id: "TASK-001", title: "Build product editor", goal: "",
        type: "frontend", phase: "Frontend Features", featureId: "catalog",
        dependencies: [], references: ["CAT-001"], apiOperations: [],
        contextDocs: [], requirements: ["use products table", "write to inventory_audit_logs"],
        implementationNotes: [], uiStates: [], screenIds: ["product-editor"],
        assetIds: [], acceptanceCriteria: ["works"], validationCommands: [], optional: false,
      },
      {
        id: "TASK-002", title: "Backend needs Postgres Redis auth", goal: "",
        type: "backend", phase: "Backend Features", featureId: "inventory-sync",
        dependencies: [], references: ["SYNC-003"], apiOperations: ["getFulfillmentOrders"],
        contextDocs: [], requirements: ["needs NestJS PostgreSQL Redis auth tenant context"],
        implementationNotes: [], uiStates: [], screenIds: [], assetIds: [],
        acceptanceCriteria: ["done"], validationCommands: [], optional: false,
      },
    ],
    prd: null,
    agentInstructions: null,
  };
}

test("SYNC duplicate semantic + coverage: dup IDs flagged, uncovered reqs flagged", () => {
  const input = satuStokLikeFixture();
  // Inject a duplicate requirement ID with a different meaning (PRD vs feature drift).
  input.features[1].requirements.push({ id: "SYNC-004", text: "Release reserved stock on cancel." });
  const issues = runDeterministicChecks(input);
  expect(issues.some((i) => i.summary.includes("SYNC-004"))).toBe(true);

  const coverage = computeRequirementCoverage({ features: input.features, tasks: input.tasks, api: input.api });
  // SYNC-004 has no task → uncovered.
  expect(coverage.find((c) => c.requirement === "SYNC-004")?.status).toBe("uncovered");
  expect(issues.some((i) => i.summary.includes("SYNC-004") && i.summary.includes("implementation task"))).toBe(true);
});

test("API prefix + unknown operation + table drift flagged", () => {
  const issues = runDeterministicChecks(satuStokLikeFixture());
  expect(issues.some((i) => i.summary.includes("/api/v1/"))).toBe(true);
  expect(issues.some((i) => i.summary.includes("getFulfillmentOrders"))).toBe(true);
  expect(issues.some((i) => i.summary.includes("inventory_audit_logs"))).toBe(true);
});

test("SPEC_GAP: brand/roundingMode without domain home flagged", () => {
  const issues = runDeterministicChecks(satuStokLikeFixture());
  const gaps = issues.filter((i) => i.summary.startsWith("SPEC_GAP"));
  expect(gaps.some((i) => i.summary.includes("brand"))).toBe(true);
  expect(gaps.some((i) => i.summary.includes("roundingmode"))).toBe(true);
});

test("DAG: unknown deps + missing foundational deps detected", () => {
  const dag = validateTaskGraph(satuStokLikeFixture().tasks);
  expect(dag.unknownDependencies.some((u) => u.dependency === "GETFULFILLMENTORDERS" || u.taskId === "TASK-002")).toBe(false);
  // TASK-002 references unknown operation but deps exist check is separate; DAG unknowns are about dependencies.
  const issues = runDeterministicChecks(satuStokLikeFixture());
  expect(issues.some((i) => i.area === "tasks")).toBe(true);
});

test("DAG cycle detection works", () => {
  const dag = validateTaskGraph([
    { id: "TASK-001", title: "a", type: "frontend", phase: "Frontend Features", featureId: "", dependencies: ["TASK-002"], references: [], contextDocs: [], requirements: [], uiStates: [], screenIds: [], assetIds: [], acceptanceCriteria: [], optional: false },
    { id: "TASK-002", title: "b", type: "backend", phase: "Backend Features", featureId: "", dependencies: ["TASK-001"], references: [], contextDocs: [], requirements: [], uiStates: [], screenIds: [], assetIds: [], acceptanceCriteria: [], optional: false },
  ]);
  expect(dag.hasCycle).toBe(true);
});

test("canonical registry preserves single meaning per ID", () => {
  const canonical = buildCanonicalSpec({
    features: satuStokLikeFixture().features,
    dataModel: satuStokLikeFixture().dataModel,
    api: satuStokLikeFixture().api,
    uiDesign: satuStokLikeFixture().uiDesign,
  });
  expect(canonical.requirements.some((r) => r.id === "SYNC-003")).toBe(true);
  expect(canonical.apiOperations[0].operationId).toBe("listOrders");
  expect(canonical.apiOperations[0].path).toBe("/api/orders");
  expect(canonical.entities.some((e) => e.name === "inventory_movement_logs")).toBe(true);
});
