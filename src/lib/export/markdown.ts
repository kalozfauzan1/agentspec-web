import {
  DECISION_SOURCE_LABEL,
  IMPLEMENTATION_STRATEGY_LABEL,
  type ApiSpec,
  type ArchitectureSpec,
  type AssetPlanSpec,
  type DataModelSpec,
  type DesignToken,
  type DocBlock,
  type FeatureSpec,
  type ImplementationTask,
  type ProjectDefinition,
  type ProjectRecord,
  type SpecDocument,
  type UiDesignSpec,
  type UserFlow,
} from "@/lib/schemas";

/**
 * Markdown is a presentation and export format, never the source of truth.
 * Everything below is rendered deterministically from validated structured data,
 * so the export can never drift from what the workspace shows (PRD §10, §28, §34).
 */

function renderBlocks(blocks: DocBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return block.text.trim();
        case "bullets":
          return block.items.map((item) => `- ${item}`).join("\n");
        case "steps":
          return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
        case "table": {
          const header = `| ${block.columns.join(" | ")} |`;
          const divider = `| ${block.columns.map(() => "---").join(" | ")} |`;
          const rows = block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
          return [header, divider, rows].join("\n");
        }
        case "callout":
          return `> ${block.tone === "warning" ? "**Warning:** " : ""}${block.text.trim()}`;
        case "code":
          return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
      }
    })
    .join("\n\n");
}

export function renderDocument(document: SpecDocument): string {
  const parts: string[] = [`# ${document.title}`];
  if (document.summary) parts.push(document.summary.trim());
  parts.push(
    ...document.sections.map((section) => `## ${section.title}\n\n${renderBlocks(section.blocks)}`),
  );
  return `${parts.join("\n\n")}\n`;
}

export function renderFeature(feature: FeatureSpec): string {
  const lines: string[] = [`# ${feature.name}`, "", `_Feature id: \`${feature.id}\`_`];

  if (feature.purpose) lines.push("", "## Purpose", "", feature.purpose.trim());

  if (feature.actors.length > 0) {
    lines.push("", "## Actors", "", feature.actors.map((actor) => `- ${actor}`).join("\n"));
  }

  if (feature.mainFlow.length > 0) {
    lines.push(
      "",
      "## Main Flow",
      "",
      feature.mainFlow.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    );
  }

  if (feature.requirements.length > 0) {
    lines.push(
      "",
      "## Requirements",
      "",
      feature.requirements.map((requirement) => `- **${requirement.id}** ${requirement.text}`).join("\n"),
    );
  }

  if (feature.businessRules.length > 0) {
    lines.push(
      "",
      "## Business Rules",
      "",
      feature.businessRules.map((rule) => `- ${rule}`).join("\n"),
    );
  }

  if (feature.edgeCases.length > 0) {
    lines.push("", "## Edge Cases", "", feature.edgeCases.map((item) => `- ${item}`).join("\n"));
  }

  if (feature.acceptanceCriteria.length > 0) {
    lines.push(
      "",
      "## Acceptance Criteria",
      "",
      feature.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n"),
    );
  }
  if (feature.uiSurfaces.length > 0) {
    lines.push("", "## UI Surfaces", "");
    for (const surface of feature.uiSurfaces) {
      lines.push(
        `### ${surface.name} (\`${surface.id}\`)`,
        "",
        surface.purpose ? surface.purpose.trim() : "",
        surface.states.length > 0 ? `States: ${surface.states.join(", ")}` : "",
      );
    }
  }
  if (feature.mediaRequirements.length > 0) {
    lines.push(
      "",
      "## Media Requirements",
      "",
      feature.mediaRequirements.map((item) => `- ${item}`).join("\n"),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function renderFlows(flows: UserFlow[]): string {
  const parts = ["# User Flows", ""];
  for (const flow of flows) {
    parts.push(`## ${flow.name}`, "");
    if (flow.primaryActor) parts.push(`**Primary actor:** ${flow.primaryActor}`, "");
    if (flow.trigger) parts.push(`**Trigger:** ${flow.trigger}`, "");
    if (flow.featureId) parts.push(`**Feature:** \`${flow.featureId}\``, "");
    parts.push(...flow.steps.map((step, index) => `${index + 1}. ${step}`), "");
    if (flow.outcome) parts.push(`**Outcome:** ${flow.outcome}`, "");
  }
  return `${parts.join("\n")}\n`;
}

export function renderArchitecture(architecture: ArchitectureSpec, definition: ProjectDefinition | null): string {
  const parts: string[] = [`# Architecture${definition ? ` — ${definition.name}` : ""}`, ""];
  if (architecture.overview) parts.push(architecture.overview.trim(), "");

  if (architecture.decisions.length > 0) {
    parts.push("## Technology Decisions", "");
    parts.push("| Component | Technology | Source | Rationale |");
    parts.push("| --- | --- | --- | --- |");
    for (const decision of architecture.decisions) {
      parts.push(
        `| ${decision.component} | ${decision.technology ?? "—"} | ${DECISION_SOURCE_LABEL[decision.source]} | ${decision.rationale || "—"} |`,
      );
    }
    parts.push("");
  }

  const { inside, outside } = architecture.systemBoundaries;
  if (inside.length > 0 || outside.length > 0) {
    parts.push("## System Boundaries", "");
    if (inside.length > 0) {
      parts.push("**Inside the system**", "", inside.map((item) => `- ${item}`).join("\n"), "");
    }
    if (outside.length > 0) {
      parts.push("**Outside the system**", "", outside.map((item) => `- ${item}`).join("\n"), "");
    }
  }

  if (architecture.dataFlow.length > 0) {
    parts.push(
      "## High-Level Data Flow",
      "",
      architecture.dataFlow.map((step, index) => `${index + 1}. ${step}`).join("\n"),
      "",
    );
  }

  if (architecture.externalServices.length > 0) {
    parts.push("## External Services", "");
    parts.push("| Service | Purpose | Source |");
    parts.push("| --- | --- | --- |");
    for (const service of architecture.externalServices) {
      parts.push(`| ${service.name} | ${service.purpose || "—"} | ${DECISION_SOURCE_LABEL[service.source]} |`);
    }
    parts.push("");
  }

  if (architecture.rules.length > 0) {
    parts.push("## Architecture Rules", "", architecture.rules.map((rule) => `- ${rule}`).join("\n"), "");
  }

  return `${parts.join("\n")}\n`;
}

export function renderDataModel(dataModel: DataModelSpec): string {
  const parts: string[] = ["# Data Model", ""];
  if (dataModel.overview) parts.push(dataModel.overview.trim(), "");

  for (const entity of dataModel.entities) {
    parts.push(`## ${entity.name}`, "");
    if (entity.purpose) parts.push(entity.purpose.trim(), "");
    if (entity.fields.length > 0) {
      parts.push("| Field | Type | Purpose | Constraints |");
      parts.push("| --- | --- | --- | --- |");
      for (const field of entity.fields) {
        parts.push(
          `| ${field.name} | ${field.type} | ${field.purpose || "—"} | ${field.constraints.join(", ") || "—"} |`,
        );
      }
      parts.push("");
    }
    if (entity.notes) parts.push(entity.notes.trim(), "");
  }

  if (dataModel.relationships.length > 0) {
    parts.push("## Relationships", "");
    for (const relationship of dataModel.relationships) {
      parts.push(
        `- **${relationship.from}** ${relationship.type} **${relationship.to}**${relationship.description ? ` — ${relationship.description}` : ""}`,
      );
    }
    parts.push("");
  }

  return `${parts.join("\n")}\n`;
}

export function renderApi(api: ApiSpec): string {
  const parts: string[] = ["# API Specification", ""];
  if (api.overview) parts.push(api.overview.trim(), "");
  if (api.authentication) parts.push("## Authentication", "", api.authentication.trim(), "");

  for (const endpoint of api.endpoints) {
    parts.push(`## ${endpoint.method} ${endpoint.path}`, "");
    parts.push(`**Purpose:** ${endpoint.purpose}`);
    if (endpoint.actor) parts.push(`**Actor:** ${endpoint.actor}`);
    parts.push(`**Authentication:** ${endpoint.authentication}`);
    if (endpoint.featureId) parts.push(`**Feature:** \`${endpoint.featureId}\``);
    parts.push("");
    if (endpoint.request) parts.push("**Request**", "", "```json", endpoint.request, "```", "");
    if (endpoint.response) parts.push("**Response**", "", "```json", endpoint.response, "```", "");
    if (endpoint.errors.length > 0) {
      parts.push("**Errors**", "");
      parts.push(...endpoint.errors.map((error) => `- \`${error.status}\` ${error.meaning || ""}`.trimEnd()));
      parts.push("");
    }
  }

  return `${parts.join("\n")}\n`;
}

export function renderUiDesign(design: UiDesignSpec): string {
  const parts: string[] = ["# UI Design Specification", ""];
  if (design.overview) parts.push(design.overview.trim(), "");

  if (design.styleDirection) parts.push("## Visual Direction", "", design.styleDirection.trim(), "");
  if (design.themeMode) parts.push(`**Theme mode:** ${design.themeMode}`, "");
  if (design.creativeConcept) {
    parts.push("## Creative Concept", "", design.creativeConcept.trim(), "");
    if (design.creativeRationale) parts.push(design.creativeRationale.trim(), "");
  }
  if (design.signatureMoments.length > 0) {
    parts.push("## Signature Moments", "");
    for (const moment of design.signatureMoments) {
      parts.push(`### ${moment.name}`, "");
      if (moment.description) parts.push(moment.description.trim(), "");
      if (moment.screenIds.length > 0) {
        parts.push(`**Screens:** ${moment.screenIds.map((id) => `\`${id}\``).join(", ")}`, "");
      }
    }
  }
  if (design.fontFamilies.length > 0) {
    parts.push("## Font Families", "");
    parts.push("| Family | Source | Fallback | Weights |");
    parts.push("| --- | --- | --- | --- |");
    parts.push(
      ...design.fontFamilies.map(
        (font) => `| ${font.family} | ${font.source || "—"} | ${font.fallback || "—"} | ${(font.weights ?? []).join(", ") || "—"} |`,
      ),
    );
    parts.push("");
  }

  if (design.principles.length > 0) {
    parts.push("## Design Principles", "", design.principles.map((item) => `- ${item}`).join("\n"), "");
  }

  const tokenLines: string[] = [];
  const tokenGroup = (
    heading: string,
    tokens: DesignToken[],
    columns: string,
    render: (token: DesignToken) => string,
  ) => {
    if (tokens.length === 0) return;
    parts.push(`## ${heading}`, "");
    parts.push(columns);
    parts.push(columns.replace(/[^|]/g, "-"));
    parts.push(...tokens.map(render));
    parts.push("");
  };

  tokenGroup("Color Tokens", design.colorTokens, "| Token | Value | Usage |", (token) => `| \`${token.name}\` | \`${token.value}\` | ${token.usage || "—"} |`);

  if (design.typographyScale.length > 0) {
    parts.push("## Typography Scale", "");
    parts.push("| Role | Size | Weight | Line height | Usage |");
    parts.push("| --- | --- | --- | --- | --- |");
    parts.push(
      ...design.typographyScale.map(
        (token) =>
          `| ${token.role} | ${token.size} | ${token.weight} | ${token.lineHeight} | ${token.usage || "—"} |`,
      ),
    );
    parts.push("");
  }

  tokenGroup("Spacing Scale", design.spacingScale, "| Token | Value | Usage |", (token) => `| \`${token.name}\` | \`${token.value}\` | ${token.usage || "—"} |`);
  tokenGroup("Radius", design.radiusTokens, "| Token | Value | Usage |", (token) => `| \`${token.name}\` | \`${token.value}\` | ${token.usage || "—"} |`);
  tokenGroup("Shadows", design.shadowTokens, "| Token | Value | Usage |", (token) => `| \`${token.name}\` | \`${token.value}\` | ${token.usage || "—"} |`);

  for (const token of [
    ...design.colorTokens,
    ...design.spacingScale,
    ...design.radiusTokens,
    ...design.shadowTokens,
  ]) {
    tokenLines.push(`  ${token.name}: ${token.value};`);
  }

  if (tokenLines.length > 0) {
    parts.push(
      "## Token Definitions",
      "",
      "Define these once and reference them everywhere. No component may hard-code a value.",
      "",
      "```css",
      ":root {",
      ...tokenLines,
      "}",
      "```",
      "",
    );
  }

  const { shell, navigation, grid, breakpoints } = design.layout;
  if (shell || navigation || grid || breakpoints.length > 0) {
    parts.push("## Layout System", "");
    if (shell) parts.push(`**Shell:** ${shell}`, "");
    if (navigation) parts.push(`**Navigation:** ${navigation}`, "");
    if (grid) parts.push(`**Grid:** ${grid}`, "");
    if (breakpoints.length > 0) {
      parts.push("| Breakpoint | Width | Behaviour |");
      parts.push("| --- | --- | --- |");
      parts.push(
        ...breakpoints.map(
          (breakpoint) => `| ${breakpoint.name} | ${breakpoint.width} | ${breakpoint.behavior || "—"} |`,
        ),
      );
      parts.push("");
    }
  }

  if (design.platformProfiles.length > 0) {
    parts.push("## Platform Profiles", "");
    for (const profile of design.platformProfiles) {
      parts.push(`### ${profile.platform}`, "");
      parts.push(`**Navigation:** ${profile.navigation}`, "");
      parts.push(`**Units:** ${profile.units}`, "");
      if (profile.inputModes.length > 0) {
        parts.push(`**Input modes:** ${profile.inputModes.join(", ")}`, "");
      }
      parts.push(`**Safe areas:** ${profile.safeAreas}`, "");
      parts.push(`**Resizing:** ${profile.resizing}`, "");
      parts.push(`**Adaptive behaviour:** ${profile.adaptiveBehavior}`, "");
    }
  }
  if (design.approvedDependencies.length > 0) {
    parts.push("## Approved UI Dependencies", "");
    parts.push("Install only the dependencies named here, and only on the listed platforms.");
    parts.push("");
    parts.push("| Purpose | Library | Source | Platforms |");
    parts.push("| --- | --- | --- | --- |");
    parts.push(
      ...design.approvedDependencies.map(
        (dependency) =>
          `| ${dependency.purpose || "—"} | ${dependency.name} | ${dependency.source} | ${dependency.platforms.join(", ") || "—"} |`,
      ),
    );
    parts.push("");
  }

  if (design.components.length > 0) {
    parts.push("## Component Inventory", "");
    parts.push(
      "Build these as shared primitives before the feature screens, and reuse them instead of writing one-off markup.",
      "",
    );
    for (const component of design.components) {
      parts.push(`### ${component.name}`, "");
      if (component.purpose) parts.push(component.purpose.trim(), "");
      if (component.variants.length > 0) {
        parts.push(`**Variants:** ${component.variants.join(", ")}`, "");
      }
      if (component.states.length > 0) {
        parts.push(`**States:** ${component.states.join(", ")}`, "");
      }
      if (component.rules.length > 0) {
        parts.push(...component.rules.map((rule) => `- ${rule}`), "");
      }
    }
  }

  if (design.screens.length > 0) {
    parts.push("## Screens", "");
    parts.push(
      "Every screen below must be implemented with the layout, components, and states listed for it.",
      "",
    );
    for (const screen of design.screens) {
      const blocks: string[] = [];
      if (screen.featureId) blocks.push(`**Feature:** \`${screen.featureId}\``);
      if (screen.purpose) blocks.push(screen.purpose.trim());
      if (screen.layout.length > 0) {
        blocks.push(
          [
            "**Layout, top to bottom**",
            "",
            ...screen.layout.map((region, index) => `${index + 1}. ${region}`),
          ].join("\n"),
        );
      }
      if (screen.components.length > 0) {
        blocks.push(`**Components:** ${screen.components.join(", ")}`);
      }
      if (screen.assetIds.length > 0) {
        blocks.push(`**Assets:** ${screen.assetIds.map((id) => `\`${id}\``).join(", ")}`);
      }
      blocks.push(
        `**States to implement:** ${screen.states.length > 0 ? screen.states.join(", ") : "populated"}`,
      );
      if (screen.responsive.length > 0) {
        blocks.push(
          ["**Responsive behaviour**", "", ...screen.responsive.map((item) => `- ${item}`)].join("\n"),
        );
      }
      if (screen.sampleContent.length > 0) {
        blocks.push(
          ["**Sample content**", "", ...screen.sampleContent.map((item) => `- ${item}`)].join("\n"),
        );
      }
      parts.push(`### ${screen.name}`, "", blocks.join("\n\n"), "");
    }
  }

  if (design.interactionRules.length > 0) {
    parts.push("## Interaction Rules", "", design.interactionRules.map((rule) => `- ${rule}`).join("\n"), "");
  }
  if (design.accessibilityRules.length > 0) {
    parts.push("## Accessibility Rules", "", design.accessibilityRules.map((rule) => `- ${rule}`).join("\n"), "");
  }
  if (design.contentRules.length > 0) {
    parts.push("## Content Rules", "", design.contentRules.map((rule) => `- ${rule}`).join("\n"), "");
  }
  if (design.antiPatterns.length > 0) {
    parts.push("## Anti-Patterns", "", design.antiPatterns.map((rule) => `- ${rule}`).join("\n"), "");
  }
  if (design.visualQaRules.length > 0) {
    parts.push("## Visual QA", "", design.visualQaRules.map((rule) => `- ${rule}`).join("\n"), "");
  }

  return `${parts.join("\n")}\n`;
}

export function renderAssetPlan(plan: AssetPlanSpec): string {
  const parts: string[] = ["# Asset Plan", ""];
  if (plan.strategy) parts.push(plan.strategy.trim(), "");

  const policy = plan.sourcePolicy;
  if (policy) {
    parts.push("## Source Policy", "");
    if (policy.rationale) parts.push(policy.rationale.trim(), "");
    parts.push(`**Free only:** ${policy.freeOnly ? "yes" : "no"}`, "");
    parts.push(`**Legal only:** ${policy.legalOnly ? "yes" : "no"}`, "");
    parts.push(`**Stored locally:** ${policy.localOnly ? "yes" : "no"}`, "");
  }

  if (plan.iconSystems.length > 0) {
    parts.push("## Icon Systems", "");
    parts.push("Use exactly one icon family per platform. Never mix icon families on the same surface.");
    parts.push("");
    for (const system of plan.iconSystems) {
      parts.push(`### ${system.platform}: ${system.family}`, "");
      parts.push(`**Size:** ${system.size}`, "");
      parts.push(`**Stroke:** ${system.stroke}`, "");
      parts.push(`**Fill:** ${system.fill}`, "");
      parts.push(`**Optical alignment:** ${system.opticalAlignment}`, "");
      parts.push(`**Color:** ${system.color}`, "");
      parts.push(`**Accessibility:** ${system.accessibility}`, "");
      if (system.mappings.length > 0) {
        parts.push("| Action | Icon |");
        parts.push("| --- | --- |");
        parts.push(
          ...system.mappings.map((mapping) => `| ${mapping.action} | ${mapping.icon} |`),
        );
        parts.push("");
      }
    }
  }

  if (plan.sources.length > 0) {
    parts.push("## Sources", "");
    parts.push("| Source | URL | Asset types | License | Attribution required | Platform restrictions |");
    parts.push("| --- | --- | --- | --- | --- | --- |");
    parts.push(
      ...plan.sources.map(
        (source) =>
          `| ${source.name || source.id} | ${source.officialUrl} | ${source.assetTypes.join(", ") || "—"} | ${source.license} | ${source.attributionRequired ? "yes" : "no"} | ${source.platformRestrictions.join(", ") || "—"} |`,
      ),
    );
    parts.push("");
  }

  if (plan.assets.length > 0) {
    parts.push("## Assets", "");
    parts.push(
      "Download every asset into its documented local path instead of hotlinking it. Implement the documented fallback so a failed asset never breaks the layout.",
      "",
    );
    for (const asset of plan.assets) {
      parts.push(`### ${asset.id}`, "");
      parts.push(`**Type:** ${asset.type}`, "");
      if (asset.purpose) parts.push(asset.purpose.trim(), "");
      if (asset.screenIds.length > 0) {
        parts.push(`**Screens:** ${asset.screenIds.map((id) => `\`${id}\``).join(", ")}`, "");
      }
      if (asset.placement) parts.push(`**Placement:** ${asset.placement}`, "");
      parts.push(`**How to obtain:** ${asset.sourceMethod}`, "");
      parts.push(`**Source:** \`${asset.sourceId}\` — \`${asset.query}\``, "");
      parts.push(`**Path:** \`${asset.destinationPath}\``, "");
      if (asset.format) parts.push(`**Format:** ${asset.format}`, "");
      if (asset.dimensions) parts.push(`**Dimensions:** ${asset.dimensions}`, "");
      if (asset.aspectRatio) parts.push(`**Aspect ratio:** ${asset.aspectRatio}`, "");
      if (asset.treatment) parts.push(`**Treatment:** ${asset.treatment}`, "");
      if (asset.altText) parts.push(`**Alt text:** ${asset.altText}`, "");
      if (asset.fallback) parts.push(`**Fallback:** ${asset.fallback}`, "");
      if (asset.platformVariants.length > 0) {
        parts.push(`**Platform variants:** ${asset.platformVariants.join(", ")}`, "");
      }
      parts.push(`**License:** ${asset.license}`, "");
      parts.push(`**Attribution:** ${asset.attribution}`, "");
    }
  }

  return `${parts.join("\n")}\n`;
}

export function renderTask(task: ImplementationTask, phaseIndex: number): string {
  const parts: string[] = [`# ${task.id} — ${task.title}`, ""];
  parts.push("| Field | Value |", "| --- | --- |");
  parts.push(`| Type | ${task.type} |`);
  parts.push(`| Phase | ${phaseIndex}. ${task.phase} |`);
  if (task.featureId) parts.push(`| Feature | \`${task.featureId}\` |`);
  parts.push(`| Dependencies | ${task.dependencies.join(", ") || "None"} |`);
  if (task.references.length > 0) parts.push(`| References | ${task.references.join(", ")} |`);
  if (task.optional) parts.push("| Optional | yes |");
  parts.push("");

  if (task.contextDocs.length > 0) {
    parts.push("## Context", "", task.contextDocs.map((doc) => `- ${doc}`).join("\n"), "");
  }
  if (task.screenIds.length > 0) {
    parts.push(
      "## Screens",
      "",
      `Implement exactly these screens from docs/ui-design.md: ${task.screenIds.map((id) => `\`${id}\``).join(", ")}. Do not invent additional screens.`,
      "",
    );
  }
  if (task.assetIds.length > 0) {
    parts.push(
      "## Assets",
      "",
      `Use exactly these assets from docs/asset-plan.md and commit each to its documented local path with its documented fallback: ${task.assetIds.map((id) => `\`${id}\``).join(", ")}.`,
      "",
    );
  }
  if (task.requirements.length > 0) {
    parts.push("## Requirements", "", task.requirements.map((item) => `- ${item}`).join("\n"), "");
  }
  if (task.uiStates.length > 0) {
    parts.push(
      "## UI States",
      "",
      task.uiStates.map((state) => `- ${state}`).join("\n"),
      "",
    );
  }
  if (task.acceptanceCriteria.length > 0) {
    parts.push(
      "## Acceptance Criteria",
      "",
      task.acceptanceCriteria.map((item) => `- ${item}`).join("\n"),
      "",
    );
  }

  return `${parts.join("\n")}\n`;
}

export function renderProductBrief(definition: ProjectDefinition): string {
  const parts = [`# ${definition.name}`, "", definition.summary.trim(), ""];
  parts.push("## Platform", "", definition.platform.map((item) => `- ${item}`).join("\n"), "");
  parts.push("## Users", "", definition.users.map((item) => `- ${item}`).join("\n"), "");
  if (definition.roles.length > 0) {
    parts.push(
      "## Roles",
      "",
      definition.roles
        .map((role) => `- **${role.name}**${role.description ? ` — ${role.description}` : ""}`)
        .join("\n"),
      "",
    );
  }
  parts.push(
    "## Core Features",
    "",
    definition.features.map((feature) => `- **${feature.name}**${feature.description ? ` — ${feature.description}` : ""}`).join("\n"),
    "",
  );
  if (definition.businessRules.length > 0) {
    parts.push("## Business Rules", "", definition.businessRules.map((rule) => `- ${rule}`).join("\n"), "");
  }
  if (definition.constraints.length > 0) {
    parts.push("## Constraints", "", definition.constraints.map((item) => `- ${item}`).join("\n"), "");
  }
  if (definition.nonGoals.length > 0) {
    parts.push("## Non-Goals", "", definition.nonGoals.map((item) => `- ${item}`).join("\n"), "");
  }
  if (definition.integrations.length > 0) {
    parts.push("## Integrations", "", definition.integrations.map((item) => `- ${item}`).join("\n"), "");
  }
  parts.push(
    "## Implementation Strategy",
    "",
    IMPLEMENTATION_STRATEGY_LABEL[definition.implementation.strategy],
    "",
  );
  if (definition.technicalPreferences.length > 0) {
    parts.push("## Technical Preferences", "");
    parts.push("| Component | Technology | Source |");
    parts.push("| --- | --- | --- |");
    for (const preference of definition.technicalPreferences) {
      parts.push(
        `| ${preference.component} | ${preference.technology ?? "—"} | ${DECISION_SOURCE_LABEL[preference.source]} |`,
      );
    }
    parts.push("");
  }
  return `${parts.join("\n")}\n`;
}

export function renderRootReadme(project: ProjectRecord): string {
  const definition = project.definition;
  const name = definition?.name ?? "Project";
  const counts = [
    `- Feature specifications: ${project.artifacts.features.length}`,
    `- Screens designed: ${project.artifacts.uiDesign?.screens.length ?? 0}`,
    `- Media assets: ${project.artifacts.assetPlan?.assets.length ?? 0}`,
    `- Implementation tasks: ${project.artifacts.tasks.length}`,
    `- API endpoints: ${project.artifacts.api?.endpoints.length ?? 0}`,
    `- Data entities: ${project.artifacts.dataModel?.entities.length ?? 0}`,
  ];

  return `# ${name} — Specification Package

${definition?.summary ?? ""}

This package was generated by AgentSpec. It is the source of truth for the implementation.

## Contents

| Path | Description |
| --- | --- |
| \`AGENTS.md\` | Global instructions the coding agent must follow. |
| \`docs/product-brief.md\` | Product definition: platform, users, features, scope. |
| \`docs/PRD.md\` | Product requirements document. |
| \`docs/user-flows.md\` | Step-by-step flows for the important interactions. |
| \`docs/ui-design.md\` | Visual direction, design tokens, components, and every screen with its layout and states. |
| \`docs/asset-plan.md\` | Icon systems, media placements, legal sources, licenses, local paths, and fallbacks. |
| \`docs/architecture.md\` | Stack decisions with their source, boundaries, and data flow. |
| \`docs/data-model.md\` | Entities, fields, constraints, and relationships. |
| \`docs/api.md\` | Endpoint contract, including error cases. |
| \`docs/features/*.md\` | One specification per core feature. |
| \`tasks/README.md\` | Task index and execution order. |
| \`tasks/TASK-*.md\` | Individual implementation tasks. |

## Package Summary

${counts.join("\n")}

## How To Use

1. Read \`AGENTS.md\` first.
2. Read the documents relevant to the task you are about to implement.
3. Follow \`tasks/README.md\` in order; respect the dependencies listed on each task.
4. Do not implement anything listed as a non-goal in \`docs/PRD.md\`.

Generated ${new Date(project.updatedAt).toISOString()}.
`;
}

export function renderTasksReadme(project: ProjectRecord): string {
  const definition = project.definition;
  const tasks = project.artifacts.tasks;
  const phases = Array.from(new Set(tasks.map((task) => task.phase)));

  const parts = [
    "# Implementation Tasks",
    "",
    `Implementation strategy: **${definition ? IMPLEMENTATION_STRATEGY_LABEL[definition.implementation.strategy] : "Frontend First"}**`,
    "",
    "Execute tasks in the order below. A task is unblocked when every task it depends on is done.",
    "",
  ];

  phases.forEach((phase, index) => {
    const phaseTasks = tasks.filter((task) => task.phase === phase);
    parts.push(`## ${index + 1}. ${phase}`, "");
    for (const task of phaseTasks) {
      const dependencies = task.dependencies.length > 0 ? ` — depends on ${task.dependencies.join(", ")}` : "";
      const optional = task.optional ? " _(optional)_" : "";
      parts.push(`- [${task.id}](./${task.id}.md) ${task.title}${dependencies}${optional}`);
    }
    parts.push("");
  });

  return `${parts.join("\n")}\n`;
}

export const STARTER_PROMPT = `Read AGENTS.md and the relevant project documentation under /docs.

Treat the provided specifications as the source of truth.

Before implementing anything:

1. Inspect the current repository.
2. Understand the documented architecture.
3. Read docs/ui-design.md and reuse the documented design tokens, component primitives, and layout instead of inventing your own.
4. Read docs/asset-plan.md and source every icon and media file from its documented local path with its documented fallback.
5. Review task dependencies.
6. Identify the first unblocked task.

Then execute tasks one at a time.

Do not implement features outside the documented scope.

For frontend-phase tasks, do not implement backend functionality unless the task explicitly requires it.

Implement every screen with the layout, components, and states documented for it in docs/ui-design.md, using realistic sample data. Do not ship a screen that only covers the happy path, and do not leave a screen with default browser styling.

Store every asset in the repository at its documented local path, keep its license and attribution note, and implement its documented fallback. Verify the result with a screenshot for every documented screen and state at each documented breakpoint before finishing.`;

export interface PackageFile {
  path: string;
  content: string;
}

export function buildPackageFiles(project: ProjectRecord): PackageFile[] {
  const files: PackageFile[] = [];
  const { definition, artifacts } = project;

  files.push({ path: "README.md", content: renderRootReadme(project) });
  if (artifacts.agentInstructions) {
    files.push({ path: "AGENTS.md", content: renderDocument(artifacts.agentInstructions) });
  }
  if (definition) {
    files.push({ path: "docs/product-brief.md", content: renderProductBrief(definition) });
  }
  if (artifacts.prd) {
    files.push({ path: "docs/PRD.md", content: renderDocument(artifacts.prd) });
  }
  if (artifacts.flows.length > 0) {
    files.push({ path: "docs/user-flows.md", content: renderFlows(artifacts.flows) });
  }
  if (artifacts.uiDesign) {
    files.push({ path: "docs/ui-design.md", content: renderUiDesign(artifacts.uiDesign) });
  }
  if (artifacts.assetPlan) {
    files.push({ path: "docs/asset-plan.md", content: renderAssetPlan(artifacts.assetPlan) });
  }
  if (artifacts.architecture) {
    files.push({
      path: "docs/architecture.md",
      content: renderArchitecture(artifacts.architecture, definition),
    });
  }
  if (artifacts.dataModel) {
    files.push({ path: "docs/data-model.md", content: renderDataModel(artifacts.dataModel) });
  }
  if (artifacts.api) {
    files.push({ path: "docs/api.md", content: renderApi(artifacts.api) });
  }
  for (const feature of artifacts.features) {
    files.push({ path: `docs/features/${feature.id}.md`, content: renderFeature(feature) });
  }
  if (artifacts.tasks.length > 0) {
    files.push({ path: "tasks/README.md", content: renderTasksReadme(project) });
    const phases = Array.from(new Set(artifacts.tasks.map((task) => task.phase)));
    for (const task of artifacts.tasks) {
      files.push({
        path: `tasks/${task.id}.md`,
        content: renderTask(task, phases.indexOf(task.phase) + 1),
      });
    }
  }

  return files;
}