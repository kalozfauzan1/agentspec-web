import type { SpecGap } from "@/lib/schemas";

export function createSpecGap(input: {
  artifact: string;
  feature?: string;
  requirement?: string;
  missing_domain_concept: string;
}): SpecGap {
  return {
    type: "SPEC_GAP",
    artifact: input.artifact,
    feature: input.feature ?? "",
    requirement: input.requirement ?? "",
    missing_domain_concept: input.missing_domain_concept,
  };
}

/**
 * Heuristic field-concept extractor used by validators: finds likely domain
 * field references (e.g. Product.brand, roundingMode) inside free-text docs
 * so missing concepts become SPEC_GAP instead of silent invention.
 */
export function extractFieldConcepts(text: string): string[] {
  const concepts = new Set<string>();
  const dotted = text.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\b/g);
  for (const match of dotted) {
    concepts.add(`${match[1]}.${match[2]}`);
  }
  const backticked = text.matchAll(/`([a-z][a-z0-9_]{2,})`/g);
  for (const match of backticked) {
    if (match[1].includes("_")) concepts.add(match[1]);
  }
  return [...concepts];
}
