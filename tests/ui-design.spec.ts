import { expect, test } from "@playwright/test";
import { demoAnalyze, demoDefinition, demoFeatures, demoUiDesign } from "../src/lib/ai/demo";
import { normalizeTasks, normalizeUiDesign } from "../src/lib/ai/normalize";
import { buildPackageFiles, renderDocument } from "../src/lib/export/markdown";
import { runStep } from "../src/lib/ai/steps";
import { projectRecordSchema, type FeatureSpec, type ProjectDefinition } from "../src/lib/schemas";

const idea =
  "Aplikasi komunitas perumahan dengan pembayaran IPL, marketplace, pengumuman, keluhan warga, dan panic button. Frontend Next.js.";

const definition = demoDefinition(idea, demoAnalyze(idea), [], []);
const features = demoFeatures(definition);
const design = normalizeUiDesign(demoUiDesign(definition, features), features);

function expectNonemptyString(value: unknown) {
  expect(typeof value).toBe("string");
  expect((value as string).trim()).not.toBe("");
}

const DOMAIN_STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "from",
  "into",
  "public",
  "screen",
  "their",
  "this",
  "tool",
  "user",
  "users",
  "with",
]);

function meaningfulWords(...values: string[]) {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length >= 4 && !DOMAIN_STOP_WORDS.has(word)) ?? [],
  );
}

const oldProject = projectRecordSchema.parse({
  id: "proj-old",
  idea: "Track household meter readings.",
  createdAt: 1,
  updatedAt: 1,
  definition: {
    name: "Meter Notes",
    summary: "A small meter-reading log.",
    visualDirection: {
      style: "quiet utility",
      themeMode: "light",
      references: ["field notebook"],
      notes: "Prioritize legibility outdoors.",
    },
  },
  artifacts: {
    prd: null,
    features: [],
    flows: [],
    uiDesign: null,
    architecture: null,
    dataModel: null,
    api: null,
    tasks: [],
    agentInstructions: null,
  },
});

const surfaceDrivenDefinition: ProjectDefinition = {
  name: "Meter Notes",
  summary: "A public tool for recording and reviewing household meter readings.",
  platform: ["web"],
  users: ["household residents"],
  roles: [],
  features: [{ name: "Meter readings", description: "Capture readings and review their history." }],
  requirements: [],
  businessRules: [],
  constraints: [],
  nonGoals: ["User accounts and authentication"],
  integrations: [],
  technicalPreferences: [],
  visualDirection: {
    style: "quiet utility",
    themeMode: "light",
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

const surfaceDrivenFeature: FeatureSpec = {
  id: "meter-readings",
  prefix: "METER",
  name: "Meter readings",
  purpose: "Capture readings and review their history.",
  actors: ["household resident"],
  mainFlow: ["Open capture", "Enter a reading", "Save it", "Review history"],
  requirements: [{ id: "METER-001", text: "Residents can record a meter reading." }],
  businessRules: [],
  edgeCases: [],
  acceptanceCriteria: [],
  userFacing: true,
  uiSurfaces: [
    {
      id: "meter-reading-capture",
      name: "Capture meter reading",
      purpose: "Record one dated meter reading.",
      states: ["idle", "validation", "submitting", "success", "error"],
    },
    {
      id: "meter-reading-history",
      name: "Meter reading history",
      purpose: "Review readings in chronological order.",
      states: ["loading", "empty", "populated", "error"],
    },
  ],
  mediaRequirements: [],
};

test("old project definitions receive defaults for every visual-intent field", () => {
  expect(oldProject.definition?.visualDirection).toEqual({
    style: "quiet utility",
    themeMode: "light",
    references: ["field notebook"],
    notes: "Prioritize legibility outdoors.",
    personality: "",
    audienceContext: "",
    desiredEmotion: "",
    informationDensity: "",
    mediaPreferences: [],
    brandConstraints: [],
    avoidPatterns: [],
  });
});

test("old project artifacts receive a null asset plan", () => {
  expect((oldProject.artifacts as Record<string, unknown>).assetPlan).toBeNull();
});

test("ui design semantically covers its features, tokens, components, and screens", () => {
  const colorSemantics = design.colorTokens
    .map((token) => `${token.name} ${token.usage}`)
    .join(" ")
    .toLowerCase();
  for (const role of [
    "canvas",
    "surface",
    "border",
    "foreground",
    "primary",
    "focus",
    "success",
    "warning",
    "danger",
  ]) {
    expect(colorSemantics, `missing semantic color role: ${role}`).toContain(role);
  }

  for (const tokens of [
    design.colorTokens,
    design.spacingScale,
    design.radiusTokens,
    design.shadowTokens,
  ]) {
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expectNonemptyString(token.name);
      expectNonemptyString(token.value);
      expectNonemptyString(token.usage);
    }
  }

  const typographyRoles = new Set(
    design.typographyScale.map((token) => token.role.trim().toLowerCase()),
  );
  for (const role of ["page title", "body", "label"]) expect(typographyRoles.has(role)).toBe(true);

  for (const feature of features) {
    expect(design.screens.some((screen) => screen.featureId === feature.id)).toBe(true);
  }
  const componentsByName = new Map(
    design.components.map((component) => [component.name.toLowerCase(), component]),
  );
  for (const screen of design.screens) {
    expect(screen.states.length).toBeGreaterThan(0);
    expect(screen.layout.length).toBeGreaterThan(0);
    for (const componentName of screen.components) {
      const component = componentsByName.get(componentName.toLowerCase());
      expect(component, `${screen.id} references undocumented component ${componentName}`).toBeDefined();
      if (!component) continue;
      expectNonemptyString(component.purpose);
      expect(component.states.length).toBeGreaterThan(0);
      expect(component.rules.length).toBeGreaterThan(0);
    }
  }
});

test("demo UI screens are derived from the feature UI surfaces", () => {
  const generated = normalizeUiDesign(
    demoUiDesign(surfaceDrivenDefinition, [surfaceDrivenFeature]),
    [surfaceDrivenFeature],
  );

  expect(generated.screens.map((screen) => screen.id)).toEqual(
    surfaceDrivenFeature.uiSurfaces.map((surface) => surface.id),
  );
});

test("demo UI does not invent sign-in or authentication surfaces", () => {
  const generated = demoUiDesign(surfaceDrivenDefinition, [surfaceDrivenFeature]);
  const screenText = JSON.stringify(generated.screens);

  expect(screenText).not.toMatch(/\bauthentication\b|\bsign[ -]?in\b|\blog[ -]?in\b/i);
});

test("UI design defines an implementation profile for every target platform", () => {
  const generated = demoUiDesign(
    { ...surfaceDrivenDefinition, platform: ["web", "iOS", "Android", "desktop"] },
    [surfaceDrivenFeature],
  ) as typeof design & {
    platformProfiles?: {
      platform: string;
      navigation: string;
      units: string;
      inputModes: string[];
      safeAreas: string;
      resizing: string;
      adaptiveBehavior: string;
    }[];
  };

  const expectedPlatforms = new Set(["web", "ios", "android", "desktop"]);
  const profiles = generated.platformProfiles ?? [];
  expect(new Set(profiles.map((profile) => profile.platform.toLowerCase()))).toEqual(
    expectedPlatforms,
  );
  expect(profiles).toHaveLength(expectedPlatforms.size);
  for (const platform of expectedPlatforms) {
    const profile = profiles.find((entry) => entry.platform.toLowerCase() === platform);
    expect(profile, `missing ${platform} platform profile`).toBeDefined();
    if (!profile) continue;
    expectNonemptyString(profile.platform);
    expectNonemptyString(profile.navigation);
    expectNonemptyString(profile.units);
    expect(profile.inputModes.length).toBeGreaterThan(0);
    for (const inputMode of profile.inputModes) expectNonemptyString(inputMode);
    expectNonemptyString(profile.safeAreas);
    expectNonemptyString(profile.resizing);
    expectNonemptyString(profile.adaptiveBehavior);
  }
});

test("UI design commits to two or three product-specific signature moments", () => {
  const generated = demoUiDesign(surfaceDrivenDefinition, [surfaceDrivenFeature]) as typeof design & {
    signatureMoments?: { name: string; description: string; screenIds: string[] }[];
  };

  expect(generated.signatureMoments).toEqual(expect.any(Array));
  expect(generated.signatureMoments!.length).toBeGreaterThanOrEqual(2);
  expect(generated.signatureMoments!.length).toBeLessThanOrEqual(3);
  const domainTerms = meaningfulWords(
    surfaceDrivenDefinition.name,
    surfaceDrivenDefinition.summary,
    ...surfaceDrivenDefinition.users,
    surfaceDrivenFeature.name,
    surfaceDrivenFeature.purpose,
    ...surfaceDrivenFeature.mainFlow,
    ...surfaceDrivenFeature.uiSurfaces.flatMap((surface) => [surface.name, surface.purpose]),
  );
  const screensById = new Map(generated.screens.map((screen) => [screen.id, screen]));
  const names = new Set<string>();
  const descriptions = new Set<string>();
  for (const moment of generated.signatureMoments ?? []) {
    expectNonemptyString(moment.name);
    expectNonemptyString(moment.description);
    const normalizedName = moment.name.trim().toLowerCase();
    const normalizedDescription = moment.description.trim().toLowerCase();
    expect(names.has(normalizedName), `duplicate signature moment name: ${moment.name}`).toBe(false);
    expect(
      descriptions.has(normalizedDescription),
      `duplicate signature moment description: ${moment.description}`,
    ).toBe(false);
    names.add(normalizedName);
    descriptions.add(normalizedDescription);

    const momentTerms = meaningfulWords(moment.name, moment.description);
    expect(
      [...momentTerms].some((term) => domainTerms.has(term)),
      `${moment.name} is not grounded in the project domain`,
    ).toBe(true);
    expect(moment.screenIds.length).toBeGreaterThan(0);
    expect(new Set(moment.screenIds).size).toBe(moment.screenIds.length);
    for (const screenId of moment.screenIds) {
      expectNonemptyString(screenId);
      expect(screensById.has(screenId), `${moment.name} references unknown screen ${screenId}`).toBe(
        true,
      );
      expect(screensById.get(screenId)?.featureId).toBe(surfaceDrivenFeature.id);
    }
  }
});

test("UI design records approved dependencies and their decision source", () => {
  const userSelectedDependency = {
    component: "Iconography",
    technology: "Phosphor Icons",
    source: "user-selected" as const,
    rationale: "Selected by the user for its adaptable icon weights.",
    alternatives: [],
  };
  const generated = demoUiDesign(
    {
      ...surfaceDrivenDefinition,
      technicalPreferences: [userSelectedDependency],
    },
    [surfaceDrivenFeature],
  ) as typeof design & {
    approvedDependencies?: {
      name: string;
      purpose: string;
      source: "user-selected" | "recommended";
      platforms: string[];
    }[];
  };

  expect(generated.approvedDependencies).toEqual(expect.any(Array));
  expect(generated.approvedDependencies!.length).toBeGreaterThan(0);
  const targetPlatforms = new Set(surfaceDrivenDefinition.platform.map((entry) => entry.toLowerCase()));
  for (const dependency of generated.approvedDependencies ?? []) {
    expectNonemptyString(dependency.name);
    expectNonemptyString(dependency.purpose);
    expect(["user-selected", "recommended"]).toContain(dependency.source);
    expect(dependency.platforms.length).toBeGreaterThan(0);
    for (const platform of dependency.platforms) {
      expectNonemptyString(platform);
      expect(
        targetPlatforms.has(platform.trim().toLowerCase()),
        `${dependency.name} documents unsupported platform ${platform}`,
      ).toBe(true);
    }
  }
  const preserved = generated.approvedDependencies?.find(
    (dependency) => dependency.name === userSelectedDependency.technology,
  );
  expect(preserved, "the user-selected dependency must remain approved").toBeDefined();
  expect(preserved?.source).toBe("user-selected");
});

test("export package ships the design specification and points UI tasks at it", () => {
  const tasks = normalizeTasks(
    [
      {
        id: "TASK-001",
        title: `Build the ${features[0].name} list screen`,
        type: "frontend",
        phase: "Frontend Features",
        featureId: features[0].id,
        dependencies: [],
        references: [],
        contextDocs: [],
        requirements: [],
        uiStates: ["loading"],
        screenIds: [],
        assetIds: [],
        acceptanceCriteria: [],
        optional: false,
      },
    ],
    features,
    definition,
  );

  const project = projectRecordSchema.parse({
    id: "proj-test",
    idea,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    definition,
    artifacts: { features, uiDesign: design, tasks },
  });

  const designFile = buildPackageFiles(project).find((file) => file.path === "docs/ui-design.md");
  expect(designFile).toBeDefined();
  expect(designFile?.content).toContain(design.colorTokens[0].name);
  expect(designFile?.content).toContain(design.colorTokens[0].value);
  expect(designFile?.content).toContain(design.components[0].name);
  expect(designFile?.content).toContain(design.screens[0].name);

  // Any task that renders UI must point the coding agent at the design specification.
  expect(tasks[0].contextDocs).toContain("docs/ui-design.md");
});

test("demo pipeline produces the design step and AGENTS.md design rules", async () => {
  const provider = {
    baseUrl: "https://provider.invalid/v1",
    apiKey: "",
    model: "test-model",
    mode: "demo" as const,
  };

  const designStep = await runStep("uiDesign", { definition, features }, provider);
  const generated = (designStep.payload as { uiDesign: typeof design }).uiDesign;
  expect(generated.screens.length).toBeGreaterThan(0);
  expect(generated.colorTokens.length).toBeGreaterThan(0);

  const instructionsStep = await runStep(
    "agentInstructions",
    { definition, tasks: [], architecture: null, uiDesign: generated },
    provider,
  );
  const markdown = renderDocument(
    (instructionsStep.payload as { agentInstructions: Parameters<typeof renderDocument>[0] })
      .agentInstructions,
  );

  expect(markdown).toContain("docs/ui-design.md");
  expect(markdown).toMatch(/design tokens?/i);
});
