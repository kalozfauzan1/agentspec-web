import { expect, test } from "@playwright/test";
import { demoAnalyze, demoDefinition, demoFeatures, demoUiDesign } from "../src/lib/ai/demo";
import { runStep } from "../src/lib/ai/steps";

const idea =
  "A public web, iOS, Android, and desktop tool for residents to record water meter readings. No accounts or sign-in.";
const definition = {
  ...demoDefinition(idea, demoAnalyze(idea), [], []),
  platform: ["web", "iOS", "Android", "desktop"],
};
const features = demoFeatures(definition);
const uiDesign = demoUiDesign(definition, features);
const provider = {
  baseUrl: "https://provider.invalid/v1",
  apiKey: "",
  model: "test-model",
  mode: "demo" as const,
};

interface GeneratedAssetPlan {
  strategy: string;
  sourcePolicy: {
    rationale: string;
    freeOnly: boolean;
    legalOnly: boolean;
    localOnly: boolean;
  };
  iconSystems: {
    platform: string;
    family: string;
    size: string;
    stroke: string;
    fill: string;
    opticalAlignment: string;
    color: string;
    accessibility: string;
    mappings: { action: string; icon: string }[];
  }[];
  sources: {
    id: string;
    officialUrl: string;
    assetTypes: string[];
    license: string;
    attributionRequired: boolean;
    platformRestrictions: string[];
  }[];
  assets: {
    id: string;
    type: string;
    purpose: string;
    screenIds: string[];
    placement: string;
    sourceMethod: string;
    sourceId: string;
    destinationPath: string;
    fallback: string;
    license: string;
    attribution: string;
  }[];
}

const UNRESOLVED_LICENSE =
  /\b(?:unknown|tbd|pending|unverified|unresolved|unconfirmed)\b|\bverify(?:-|\s+)before(?:-|\s+)use\b|\b(?:awaiting|requires?|required)\s+(?:license\s+)?verification\b|\bverification\s+(?:pending|required)\b|\b(?:to be|not yet)\s+(?:verified|confirmed)\b/i;

function isSafeRepositoryLocalPath(value: string) {
  const normalized = value.replaceAll("\\", "/").trim();
  if (!normalized || normalized.startsWith("/") || normalized.startsWith("~/")) return false;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalized)) return false;
  if (normalized.endsWith("/")) return false;
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment === "." || segment === "..")) return false;
  const fileName = segments[segments.length - 1];
  return /\.[a-z0-9]{1,8}$/i.test(fileName);
}

function expectTrimmedNonemptyString(value: unknown) {
  expect(typeof value).toBe("string");
  expect(value).toBe((value as string).trim());
  expect((value as string).length).toBeGreaterThan(0);
}

function expectAllTextFieldsTrimmed(value: unknown): void {
  if (typeof value === "string") {
    expectTrimmedNonemptyString(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) expectAllTextFieldsTrimmed(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const field of Object.values(value)) expectAllTextFieldsTrimmed(field);
  }
}

async function generateAssetPlan() {
  const step = "assetPlan" as Parameters<typeof runStep>[0];
  const request = { definition, features, architecture: null, uiDesign } as Parameters<
    typeof runStep
  >[1];
  const outcome = await runStep(step, request, provider).then(
    (result) => ({ result, error: null }),
    (error: unknown) => ({ result: null, error }),
  );
  expect(outcome.error, "assetPlan generation must be registered").toBeNull();
  return (outcome.result!.payload as { assetPlan: GeneratedAssetPlan }).assetPlan;
}

test("asset plan defines one concrete icon system for every target platform", async () => {
  const plan = await generateAssetPlan();
  const targetPlatforms = definition.platform.map((platform) => platform.toLowerCase());

  expect(plan.iconSystems).toHaveLength(targetPlatforms.length);
  for (const platform of targetPlatforms) {
    expect(
      plan.iconSystems.filter((system) => system.platform.toLowerCase() === platform),
      `expected exactly one icon system for ${platform}`,
    ).toHaveLength(1);
  }
  for (const system of plan.iconSystems) {
    expectTrimmedNonemptyString(system.platform);
    expectTrimmedNonemptyString(system.family);
    expectTrimmedNonemptyString(system.size);
    expectTrimmedNonemptyString(system.stroke);
    expectTrimmedNonemptyString(system.fill);
    expectTrimmedNonemptyString(system.opticalAlignment);
    expectTrimmedNonemptyString(system.color);
    expectTrimmedNonemptyString(system.accessibility);
    expect(system.mappings.length).toBeGreaterThan(0);
    for (const mapping of system.mappings) {
      expectAllTextFieldsTrimmed(mapping);
    }
  }
});

test("asset plan records legal source metadata", async () => {
  const plan = await generateAssetPlan();

  expectTrimmedNonemptyString(plan.strategy);
  expectTrimmedNonemptyString(plan.sourcePolicy.rationale);
  expect(plan.sourcePolicy.freeOnly).toBe(true);
  expect(plan.sourcePolicy.legalOnly).toBe(true);
  expect(plan.sourcePolicy.localOnly).toBe(true);
  expect(plan.sources.length).toBeGreaterThan(0);
  for (const source of plan.sources) {
    expectAllTextFieldsTrimmed(source);
    expectTrimmedNonemptyString(source.id);
    expectTrimmedNonemptyString(source.officialUrl);
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(source.officialUrl);
    } catch {
      // The assertion below reports the invalid source URL with its source id.
    }
    expect(parsedUrl, `${source.id} must have a valid official URL`).not.toBeNull();
    if (parsedUrl) {
      expect(["http:", "https:"]).toContain(parsedUrl.protocol);
      expectTrimmedNonemptyString(parsedUrl.hostname);
    }
    expect(source.assetTypes.length).toBeGreaterThan(0);
    for (const assetType of source.assetTypes) expectTrimmedNonemptyString(assetType);
    expectTrimmedNonemptyString(source.license);
    expect(source.license).not.toMatch(UNRESOLVED_LICENSE);
    expect(typeof source.attributionRequired).toBe("boolean");
    expect(Array.isArray(source.platformRestrictions)).toBe(true);
    for (const restriction of source.platformRestrictions) expectTrimmedNonemptyString(restriction);
  }
});

test("asset entries use local destinations with licenses and intentional fallbacks", async () => {
  const plan = await generateAssetPlan();

  expect(plan.assets.length).toBeGreaterThan(0);
  for (const asset of plan.assets) {
    expectAllTextFieldsTrimmed(asset);
    expectTrimmedNonemptyString(asset.id);
    expectTrimmedNonemptyString(asset.type);
    expectTrimmedNonemptyString(asset.purpose);
    expectTrimmedNonemptyString(asset.placement);
    expectTrimmedNonemptyString(asset.sourceMethod);
    expectTrimmedNonemptyString(asset.sourceId);
    expect(plan.sources.some((source) => source.id === asset.sourceId)).toBe(true);
    expectTrimmedNonemptyString(asset.destinationPath);
    expect(
      isSafeRepositoryLocalPath(asset.destinationPath),
      `${asset.destinationPath} must be a safe repository-local path`,
    ).toBe(true);
    expectTrimmedNonemptyString(asset.fallback);
    expectTrimmedNonemptyString(asset.license);
    expect(asset.license).not.toMatch(UNRESOLVED_LICENSE);
    expectTrimmedNonemptyString(asset.attribution);
  }
});

test("every asset placement references an existing UI screen", async () => {
  const plan = await generateAssetPlan();
  const screenIds = new Set(uiDesign.screens.map((screen) => screen.id));

  for (const asset of plan.assets) {
    expect(asset.screenIds.length).toBeGreaterThan(0);
    for (const screenId of asset.screenIds) {
      expectTrimmedNonemptyString(screenId);
      expect(screenIds.has(screenId), `${asset.id} references unknown screen ${screenId}`).toBe(true);
    }
  }
});
