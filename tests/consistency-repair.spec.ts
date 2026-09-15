import { expect, test } from "@playwright/test";
import { consistencyReportSchema, type ConsistencyIssue } from "../src/lib/schemas";
import {
  buildRepairInstruction,
  issueArtifactLabel,
  planRepairs,
  splitIssues,
} from "../src/lib/validation/issues";

function issue(overrides: Partial<ConsistencyIssue> = {}): ConsistencyIssue {
  return {
    id: "issue-1",
    severity: "high",
    area: "general",
    summary: "Ringkasan masalah",
    detail: "Detail masalah",
    artifacts: ["tasks"],
    suggestion: "Saran perbaikan",
    ...overrides,
  };
}

test("splits blocking issues from advisory notes", () => {
  const { blocking, optional } = splitIssues([
    issue({ id: "a", severity: "high" }),
    issue({ id: "b", severity: "medium" }),
    issue({ id: "c", severity: "low" }),
  ]);

  expect(blocking.map((entry) => entry.id)).toEqual(["a"]);
  expect(optional.map((entry) => entry.id)).toEqual(["b", "c"]);
});

test("repairs only documents that own a blocking issue", () => {
  const plans = planRepairs(
    [issue({ id: "high-1", artifacts: ["assetPlan"] })],
    [
      issue({ id: "high-1", artifacts: ["assetPlan"] }),
      issue({ id: "medium-1", severity: "medium", artifacts: ["assetPlan"] }),
      issue({ id: "medium-2", severity: "medium", artifacts: ["tasks"] }),
    ],
  );

  expect(plans).toHaveLength(1);
  expect(plans[0].target).toBe("assetPlan");
  expect(plans[0].issues.map((entry) => entry.id)).toEqual(["high-1", "medium-1"]);
});

test("falls back to the next known artifact and skips issues without one", () => {
  const plans = planRepairs(
    [
      issue({ id: "high-1", artifacts: ["data-model", "dataModel"] }),
      issue({ id: "high-2", artifacts: ["unknown-area"] }),
    ],
    [],
  );

  expect(plans).toHaveLength(1);
  expect(plans[0].target).toBe("dataModel");
});

test("groups repairs for the project definition target", () => {
  const plans = planRepairs([issue({ id: "high-1", artifacts: ["definition", "prd"] })], []);

  expect(plans).toHaveLength(1);
  expect(plans[0].target).toBe("definition");
});

test("repair instruction carries every finding with its detail and suggestion", () => {
  const instruction = buildRepairInstruction("tasks", [
    issue({ id: "a", summary: "Task tanpa UI state", detail: "TASK-014", suggestion: "Tambah uiStates" }),
    issue({ id: "b", severity: "medium", summary: "Task tanpa dependency", detail: "", suggestion: "" }),
  ]);

  expect(instruction.includes('"tasks"')).toBe(true);
  expect(instruction.includes("(high) Task tanpa UI state")).toBe(true);
  expect(instruction.includes("Detail: TASK-014")).toBe(true);
  expect(instruction.includes("Suggested fix: Tambah uiStates")).toBe(true);
  expect(instruction.includes("(medium) Task tanpa dependency")).toBe(true);
});

test("artifact labels stay readable for known and unknown entries", () => {
  expect(issueArtifactLabel("uiDesign")).toBe("UI Design");
  expect(issueArtifactLabel("definition")).toBe("Project definition");
  expect(issueArtifactLabel("mystery")).toBe("mystery");
});

test("older validation reports receive a zero auto-fix counter", () => {
  const parsed = consistencyReportSchema.parse({ checkedAt: 1, issues: [] });

  expect(parsed.autoFixed).toBe(0);
});
