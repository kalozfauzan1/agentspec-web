import {
  ARTIFACT_KEYS,
  ARTIFACT_META,
  type ArtifactKey,
  type ConsistencyIssue,
} from "@/lib/schemas";

export type RepairTarget = ArtifactKey | "definition";

export const ISSUE_SEVERITY_LABEL: Record<ConsistencyIssue["severity"], string> = {
  high: "Perlu diperbaiki",
  medium: "Saran",
  low: "Catatan",
};

export function isBlockingIssue(issue: ConsistencyIssue) {
  return issue.severity === "high";
}

export function splitIssues(issues: ConsistencyIssue[]) {
  return {
    blocking: issues.filter(isBlockingIssue),
    optional: issues.filter((issue) => !isBlockingIssue(issue)),
  };
}

const ARTIFACT_LABELS: Record<string, string> = {
  ...Object.fromEntries(ARTIFACT_KEYS.map((key) => [key, ARTIFACT_META[key].label])),
  definition: "Project definition",
};

export function issueArtifactLabel(artifact: string) {
  return ARTIFACT_LABELS[artifact] ?? artifact;
}

function isArtifactKey(value: string): value is ArtifactKey {
  return (ARTIFACT_KEYS as readonly string[]).includes(value);
}

/**
 * Checks list the artifact that owns the problem first, so that entry is the
 * one an automatic repair should rewrite.
 */
export function repairTargetFor(issue: ConsistencyIssue): RepairTarget | null {
  for (const artifact of issue.artifacts) {
    if (artifact === "definition" || isArtifactKey(artifact)) return artifact;
  }
  return null;
}

export interface RepairPlan {
  target: RepairTarget;
  issues: ConsistencyIssue[];
}

/**
 * Blocking issues decide which documents get repaired. Advisory issues that sit
 * on the same document ride along, because that document is rewritten anyway.
 */
export function planRepairs(blocking: ConsistencyIssue[], all: ConsistencyIssue[]): RepairPlan[] {
  const plans = new Map<RepairTarget, ConsistencyIssue[]>();

  for (const issue of blocking) {
    const target = repairTargetFor(issue);
    if (!target) continue;
    plans.set(target, [...(plans.get(target) ?? []), issue]);
  }

  for (const issue of all) {
    if (issue.severity !== "medium") continue;
    const target = repairTargetFor(issue);
    if (!target) continue;
    const planned = plans.get(target);
    if (!planned || planned.some((entry) => entry.id === issue.id)) continue;
    planned.push(issue);
  }

  return [...plans].map(([target, issues]) => ({ target, issues }));
}

export function buildRepairInstruction(target: RepairTarget, issues: ConsistencyIssue[]) {
  const findings = issues.map((issue, index) =>
    [
      `${index + 1}. (${issue.severity}) ${issue.summary}`,
      issue.detail ? `   Detail: ${issue.detail}` : "",
      issue.suggestion ? `   Suggested fix: ${issue.suggestion}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `The consistency check found the following problems in "${target}".`,
    "Fix them here and nowhere else: apply the suggested fix when it is concrete, keep ids, names, and cross-references stable, and leave every part the problems do not mention exactly as it is.",
    "",
    ...findings,
  ].join("\n");
}
