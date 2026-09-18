import {
  ARTIFACT_KEYS,
  FRONTEND_FIRST_PHASES,
  type ApiSpec,
  type ArchitectureSpec,
  type ClarificationAnswer,
  type DataModelSpec,
  type FeatureOutline,
  type FeatureSpec,
  type IdeaAnalysis,
  type AssetPlanSpec,
  type ImplementationTask,
  type ProjectDefinition,
  type SpecDocument,
  type UiDesignSpec,
  type UserFlow,
} from "@/lib/schemas";

/* ------------------------------------------------------------------ */
/* Shared rules                                                       */
/* ------------------------------------------------------------------ */

const GLOBAL_RULES = `You are AgentSpec, a specification engine that converts a software idea into a coding-agent-ready specification package.

GLOBAL RULES
1. Every generated document MUST be written in English, even when the user's input is in another language.
2. Never silently replace a technology, platform, or product decision the user made explicitly. Preserve it and label it "user-selected".
3. When you choose something yourself, label it "recommended". When the user has not decided and you cannot confidently recommend, use "undecided" and set the technology to null.
4. Only describe what the project definition allows. Never invent features, roles, entities, or endpoints outside it.
5. Write concrete, implementable, testable statements. No marketing language, no filler, no placeholders like "TBD" or "lorem ipsum".
6. Keep requirement identifiers stable, uppercase, and formatted like PANIC-001.
7. Answer with valid JSON only. No markdown fences, no commentary, no trailing text.

CANONICAL SOURCE-OF-TRUTH RULES
8. Generate strictly from the canonical specification provided in the request. Do not redefine requirements, entities, enums, states, identifiers, or domain rules.
9. Do not invent missing domain concepts (fields, entities, enums, endpoints, screens). If required information is absent, return a SPEC_GAP entry: {"type":"SPEC_GAP","artifact":"<this-artifact>","feature":"<feature-id>","requirement":"<what needs it>","missing_domain_concept":"<Entity.field>"} instead of inventing it.
10. All references must use canonical identifiers exactly: requirement IDs, entity/table names, field names, endpoint operationIds/paths, screen IDs, asset IDs, task IDs.
11. Downstream artifacts must REFER to canonical IDs; they must never change the semantic meaning of a requirement ID.`;

const frontendFirstRules = (phases: readonly string[]) => `Implementation phases for frontend-first (use these names exactly): ${phases.join(
  " → ",
)}.`;

/* ------------------------------------------------------------------ */
/* Step: analyze idea (PRD §8)                                        */
/* ------------------------------------------------------------------ */

export function promptAnalyze(idea: string) {
  return {
    system: `${GLOBAL_RULES}

TASK
Analyse the software idea and extract a structured understanding of it. Detect product type, purpose, platform, target users, roles, core features, business rules, integrations, explicit technical preferences, explicit visual preferences, constraints, explicit exclusions, and the ambiguities that genuinely block implementation.

The user may write in Indonesian, English, or a mix. Understand both languages. All extracted values must be written in English.

Return JSON with this exact shape:
{
  "suggestedName": "short product name",
  "summary": "2-3 sentence product summary",
  "productType": "category of product",
  "purpose": "what problem it solves and for whom",
  "platform": ["web" | "mobile" | "desktop" | ...],
  "targetUsers": ["who uses it"],
  "roles": [{ "name": "Role", "description": "...", "responsibilities": ["..."] }],
  "coreFeatures": [{ "name": "Feature name", "description": "what it does" }],
  "businessRules": ["rule that constrains behaviour"],
  "integrations": ["external system the product must talk to"],
  "technicalPreferences": [{ "component": "Frontend", "technology": "Next.js" | null, "source": "user-selected" | "recommended" | "undecided", "rationale": "why", "alternatives": [] }],
  "visualPreferences": ["visual style, theme mode, design language, or product the user wants the interface to resemble"],
  "constraints": ["budget, platform, regulation, team, or timeline constraint"],
  "nonGoals": ["thing explicitly NOT included"],
  "ambiguities": ["decision that is still unclear and materially changes implementation"]
}`,
    user: `SOFTWARE IDEA\n"""\n${idea.trim()}\n"""`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: clarification questions (PRD §9) — user-facing, Indonesian   */
/* ------------------------------------------------------------------ */

export function promptClarify(idea: string, analysis: IdeaAnalysis) {
  return {
    system: `${GLOBAL_RULES}

TASK
Write the clarification questions that resolve the ambiguities in this project.

LANGUAGE OVERRIDE
These questions are shown directly to the user, who communicates in Indonesian. Write "question", "description", "why", and every option "label" and "description" in Indonesian. Keep technical terms in English when that is how developers normally say them (e.g. "payment gateway", "realtime", "dark mode").

RULES
- Generate between 4 and 7 questions. Quality over quantity.
- Only ask about decisions that materially change product behaviour or implementation. Do not ask about things you can safely recommend later.
- Every question must be specific to THIS project. Never reuse a generic questionnaire.
- Prefer "radio" with 3-4 concrete options. Use "checkbox" when multiple answers can combine. Use "text" only for genuinely open input.
- Options must be mutually exclusive, decision-shaped, and short. Add a short description that explains the consequence of choosing it.
- "why" explains in one short Indonesian sentence why this decision matters.
- Map each question to one category from: users, roles-permissions, business-flow, feature-behavior, platform, integrations, payment, data, technical, visual-design.
- Ask visual-design questions only when the answer materially changes the interface: for example when the audience is ambiguous, the product could plausibly be a dense operator tool or a consumer app, or the user already hinted at a visual reference. One well-chosen visual question is better than three.
- A visual-design question must offer concrete, decision-shaped choices (for example a focused consumer flow, a dense operator workspace, a premium editorial layout) or ask for a product the interface should resemble. Never ask the user to choose a hex color or a font.
- When the user has already described the look, do not repeat it as a question. When visual intent stays thin, the definition step infers one product-specific direction instead of asking again.
- Never ask the user which implementation strategy to use; frontend-first is the default and only changes on explicit request.

Return JSON:
{ "questions": [ { "id": "kebab-case-id", "question": "…?", "description": "…", "why": "…", "type": "radio" | "checkbox" | "text", "category": "…", "options": [{ "label": "…", "description": "…" }] } ] }`,
    user: `IDEA\n"""\n${idea.trim()}\n"""

DETECTED ANALYSIS
${JSON.stringify(analysis, null, 2)}

Write the clarification questions that resolve the ambiguities listed above.`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: project definition (PRD §10)                                 */
/* ------------------------------------------------------------------ */

export function promptDefinition(
  idea: string,
  analysis: IdeaAnalysis,
  questions: { id: string; question: string; type: string; options: { label: string }[] }[],
  answers: ClarificationAnswer[],
) {
  const answerBlock = questions
    .map((question) => {
      const answer = answers.find((entry) => entry.questionId === question.id);
      const selected = answer?.values.length ? answer.values.join(", ") : "(not answered)";
      const custom = answer?.custom?.trim() ? ` | custom: ${answer.custom.trim()}` : "";
      return `- [${question.id}] ${question.question}\n  answer: ${selected}${custom}`;
    })
    .join("\n");

  return {
    system: `${GLOBAL_RULES}

TASK
Build the Project Definition — the single source of truth for this project. Every later document is derived from it, so it must be complete, internally consistent, and free of contradictions.

RULES
- Explicit user answers win over your own assumptions.
- technicalPreferences must record ONE entry per relevant component (Frontend, Backend, Database, Authentication, Storage, Realtime, Payment, Notifications, ...). Only include components relevant to this project.
- "source" is "user-selected" only when the user actually chose it in the idea or the answers. Mark your own choices "recommended". Mark genuinely open choices "undecided" with technology null.
- features must be the concrete core features (3-9), not vague categories.
- nonGoals must explicitly capture what is out of scope, including things the clarification answers excluded.
- visualDirection records how the product must look: style, theme mode ("light", "dark", or "both"), reference products, personality, audience context, desired emotion, information density, media preferences, brand constraints, and patterns to avoid. Take it from the user's answers and the idea. When the user said little, infer ONE product-specific direction from the domain, audience, usage context, and platform, and state the reasoning in "notes" — never fall back to a universal dashboard preset and never leave every field empty, because the UI design specification is derived from it.
- platform must list every target platform the product needs (for example "web", "iOS", "Android", "desktop"), because the UI design specification defines a behavior profile for each one.
- implementation.strategy: "frontend-first" by default. Use "module-first" ONLY if the user explicitly asked for module-by-module / vertical-slice work.
- Do not include any implementation detail that belongs to architecture, data model, or tasks.

Return JSON:
{
  "name": "…",
  "summary": "…",
  "platform": ["…"],
  "users": ["…"],
  "roles": [{ "name": "…", "description": "…", "responsibilities": ["…"] }],
  "features": [{ "name": "…", "description": "…" }],
  "requirements": ["cross-cutting product requirement"],
  "businessRules": ["…"],
  "constraints": ["…"],
  "nonGoals": ["…"],
  "integrations": ["…"],
  "technicalPreferences": [{ "component": "…", "technology": "…" | null, "source": "user-selected" | "recommended" | "undecided", "rationale": "…", "alternatives": ["…"] }],
  "visualDirection": {
    "style": "…",
    "themeMode": "light" | "dark" | "both",
    "references": ["…"],
    "notes": "why this direction fits the product",
    "personality": "…",
    "audienceContext": "…",
    "desiredEmotion": "…",
    "informationDensity": "…",
    "mediaPreferences": ["…"],
    "brandConstraints": ["…"],
    "avoidPatterns": ["…"]
  },
  "implementation": { "strategy": "frontend-first" | "module-first" }
}`,
    user: `IDEA\n"""\n${idea.trim()}\n"""

ANALYSIS
${JSON.stringify(analysis, null, 2)}

CLARIFICATION ANSWERS
${answerBlock || "(no answers provided)"}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: PRD (PRD §14)                                                */
/* ------------------------------------------------------------------ */

export const PRD_SECTION_TITLES = [
  "Product Overview",
  "Problem Statement",
  "Product Goals",
  "Target Users",
  "User Roles",
  "Core Features",
  "Functional Requirements",
  "User Flows",
  "Business Rules",
  "Edge Cases",
  "Non-Functional Requirements",
  "Non-Goals",
  "MVP Scope",
] as const;

export function promptPrd(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  part?: { index: number; total: number; sectionTitles: string[] },
) {
  const featureBlock =
    features.length > 0
      ? `\n\nThe feature specifications already exist — reuse their requirement ids and wording so the PRD and the feature specs stay traceable to each other:\n${JSON.stringify(
          features.map((feature) => ({
            id: feature.id,
            name: feature.name,
            purpose: feature.purpose,
            requirements: feature.requirements.map((requirement) => requirement.id),
            actors: feature.actors,
          })),
          null,
          2,
        )}`
      : "";

  const sectionList = part ? part.sectionTitles : [...PRD_SECTION_TITLES];
  const scopeBlock = part
    ? `\n\nSECTION SCOPE
This is part ${part.index} of ${part.total} of the document. Write ONLY these sections, in this order:\n${part.sectionTitles
        .map((title, index) => `${index + 1}. ${title}`)
        .join("\n")}
Other parts cover the remaining sections — do not write them.`
    : "";

  return {
    system: `${GLOBAL_RULES}

TASK
Write the Product Requirements Document. It describes WHAT must be built and WHY — not how to implement it.

Required sections, in this order, with these titles:
${PRD_SECTION_TITLES.map((title, index) => `${index + 1}. ${title}`).join("\n")}

RULES
- Functional Requirements must be grouped per feature and must carry the stable requirement ids (e.g. PANIC-001) from the feature specifications.
- Always include an explicit Non-Goals section listing everything excluded. This is how the coding agent learns what NOT to build.
- Every section must contain at least one block. Never emit a section with an empty block list.
- Keep the whole document tight: at most 3 blocks per section and one short sentence per bullet.
- MVP Scope states what ships in the MVP and what is deliberately deferred.
- Non-Functional Requirements must capture the experience constraints that matter for the interface: the target platforms, the accessibility expectations, and any visual constraint the definition records.
- Record the desired product experience (how the product should feel to use) without prescribing colors, fonts, or components — those live in the UI design specification.
- Never include implementation instructions, framework commands, database schema, or task lists.

Return JSON:
{
  "title": "Product Requirements Document — <product name>",
  "summary": "one paragraph",
  "sections": [
    { "id": "kebab-case", "title": "Product Overview", "blocks": [ { "type": "paragraph", "text": "…" } ] }
  ]
}

Allowed block shapes:
{ "type": "paragraph", "text": "…" }
{ "type": "bullets", "items": ["…"] }
{ "type": "steps", "items": ["…"] }
{ "type": "table", "columns": ["…"], "rows": [["…"]] }
{ "type": "callout", "tone": "info" | "warning", "text": "…" }`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}${featureBlock}${scopeBlock}

Sections to produce now: ${sectionList.map((title) => `"${title}"`).join(", ")}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: feature specifications (PRD §15)                             */
/* ------------------------------------------------------------------ */

export function promptFeatures(
  definition: ProjectDefinition,
  batch?: { index: number; total: number; subset: FeatureOutline[] },
) {
  const focus = batch?.subset ?? definition.features;
  const inBatches = Boolean(batch && batch.total > 1);
  const scopedDefinition = inBatches ? { ...definition, features: focus } : definition;

  const scopeBlock = inBatches
    ? `\n\nSCOPE OF THIS REQUEST
This is batch ${batch!.index} of ${batch!.total}. Write specifications ONLY for these ${focus.length} features:
${focus.map((feature) => `- ${feature.name}: ${feature.description}`).join("\n")}
The remaining features are handled in other batches — do not describe them.`

    : "";

  return {
    system: `${GLOBAL_RULES}

TASK
Write one detailed specification for every feature listed in the project definition.

RULES
- Produce exactly one entry per listed feature, in the same order. Use a kebab-case "id" derived from the feature name.
- "prefix" is a short uppercase code for requirement ids (e.g. "PANIC", "MARKET").
- Requirements must be atomic, testable statements, numbered sequentially as PREFIX-001, PREFIX-002, …
- Keep every string to one sentence (under about 200 characters). 4-6 requirements and 4-6 main-flow steps per feature is enough.
- mainFlow is an ordered list of user/system steps from entry point to result.
- acceptanceCriteria are objectively verifiable conditions ("accidental activation is prevented", not "works well").
- edgeCases cover failure, empty, permission, concurrency, and offline cases relevant to the feature.
- businessRules state constraints the implementation must enforce.
- "userFacing" is false only when the feature has no screen at all.
- Every user-facing feature lists its "uiSurfaces": one entry per distinct screen the feature needs, with a kebab-case id, a short name, the purpose of that screen, and the states it must implement. Derive the surfaces from the feature's own flow — never add a list/detail/table pattern, a dashboard, or a sign-in screen that the requirements do not need.
- "mediaRequirements" lists only the media the feature genuinely needs (for example a photo uploaded by the user, an illustration for an empty state), or an empty list.

Return JSON:
{
  "features": [
    {
      "id": "kebab-case",
      "prefix": "PANIC",
      "name": "Panic Button",
      "purpose": "why this feature exists",
      "actors": ["Resident"],
      "mainFlow": ["step 1", "step 2"],
      "requirements": [{ "id": "PANIC-001", "text": "…" }],
      "businessRules": ["…"],
      "edgeCases": ["…"],
      "acceptanceCriteria": ["…"],
      "userFacing": true,
      "uiSurfaces": [
        { "id": "kebab-case", "name": "Screen name", "purpose": "what the screen achieves", "states": ["loading", "empty", "populated", "error"] }
      ],
      "mediaRequirements": []
    }
  ]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(scopedDefinition, null, 2)}${scopeBlock}

Cover every feature listed under "features".`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: user flows (PRD §16)                                         */
/* ------------------------------------------------------------------ */

export function promptFlows(definition: ProjectDefinition, features: FeatureSpec[]) {
  return {
    system: `${GLOBAL_RULES}

TASK
Write the user flows for the most important interactions of this product.

RULES
- Produce between 3 and 6 flows. Cover the primary journey plus the flows that carry the most risk.
- Each flow must be readable, not a diagram: trigger → ordered steps → outcome.
- Steps alternate between user actions and system responses and must be consistent with the feature specifications.
- "featureId" must reference one of the provided feature ids, or be an empty string when the flow is cross-feature.

Return JSON:
{
  "flows": [
    {
      "id": "kebab-case",
      "name": "Create Complaint",
      "featureId": "complaints",
      "primaryActor": "Resident",
      "trigger": "what starts the flow",
      "steps": ["Resident opens Complaints", "System shows complaint list", "…"],
      "outcome": "what the user ends up with"
    }
  ]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

FEATURES
${JSON.stringify(
  features.map((feature) => ({ id: feature.id, name: feature.name, actors: feature.actors })),
  null,
  2,
)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: UI design specification                                      */
/* ------------------------------------------------------------------ */

export function promptUiDesign(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  architecture: ArchitectureSpec | null,
) {
  const visual = definition.visualDirection;
  const direction = [
    visual.style ? `Style requested by the user: ${visual.style}` : "",
    visual.themeMode ? `Theme mode requested by the user: ${visual.themeMode}` : "",
    visual.references.length > 0 ? `References named by the user: ${visual.references.join(", ")}` : "",
    visual.personality ? `Personality the user asked for: ${visual.personality}` : "",
    visual.audienceContext ? `Audience context: ${visual.audienceContext}` : "",
    visual.desiredEmotion ? `Emotion the interface should create: ${visual.desiredEmotion}` : "",
    visual.informationDensity ? `Information density: ${visual.informationDensity}` : "",
    visual.mediaPreferences.length > 0
      ? `Media preferences: ${visual.mediaPreferences.join(", ")}`
      : "",
    visual.brandConstraints.length > 0
      ? `Brand constraints: ${visual.brandConstraints.join(", ")}`
      : "",
    visual.avoidPatterns.length > 0 ? `Patterns to avoid: ${visual.avoidPatterns.join(", ")}` : "",
    visual.notes ? `Notes from the user: ${visual.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system: `${GLOBAL_RULES}

TASK
Write the UI design specification. A coding agent implements every screen from this document, so it is the difference between a generic unstyled application and a finished product. Nothing about the visual result may be left to interpretation.

RULES
- Respect the visual direction the project provides. When the project does not provide one, commit to one direction yourself. Never write that something "can be decided later".
- Start with a "creativeConcept" and "creativeRationale" that are specific to THIS product: name the idea that makes the interface recognisable instead of describing a generic dashboard.
- Define two or three "signatureMoments": a deliberate visual or interaction highlight tied to concrete screen ids, not decoration.
- List "fontFamilies" with a legal source and a system fallback, and map the type scale to those families.
- Define one "platformProfiles" entry for EVERY platform in the project definition (web, iOS, Android, desktop, …) covering navigation, units, input modes, safe areas, resizing, and adaptive behaviour.
- List "approvedDependencies" for the UI tooling the implementation may install (icon family, chart library, animation, map, component primitives). Preserve any user-selected technology from the definition and mark your own choices "recommended". Restrict each dependency to the platforms where it is valid.
- Every screen lists the "assetIds" of the assets it renders; leave the list empty until the asset plan exists, but never reference an asset that has no screen.
- Vague adjectives are not requirements. "Modern", "clean", or "nice" must always be expressed as concrete values: hex colors, px or rem sizes, weights, radii, and full shadow values.
- Name tokens by role, not by appearance: --color-surface, --color-primary, --space-4. Never --blue-500.
- Minimum coverage: 8-12 color tokens (canvas, surface, border, foreground, muted foreground, primary, primary hover, success, warning, danger, focus ring), 5-7 typography roles, a 4px-based spacing scale with 6-8 steps, 3-5 radius tokens, and 3-4 shadow tokens.
- The component inventory must cover every component the screens use, and each component lists its variants and the interactive states it needs (default, hover, focus-visible, active, disabled, loading, error).
- Produce exactly one screen per documented feature uiSurface, keeping its id, and add a shared surface only when a requirement needs it (for example sign-in only when authentication is in scope). Use the feature id from the feature specifications, or an empty string for shared surfaces.
- For every screen describe: the purpose, the layout as ordered regions from top to bottom, the components it uses, every state it must implement (loading, empty, populated, error, validation, success, and permission-denied where relevant), how it adapts at each breakpoint, and the realistic sample content it must render.
- "layout.grid" and "layout.breakpoints" must be specific enough to implement: container width, column count, gutters, and exactly what changes at each breakpoint.
- interactionRules must cover hover, focus, transitions, destructive action confirmation, and how the user gets feedback after an action.
- accessibilityRules must cover contrast, focus visibility, labels, keyboard order, and minimum target sizes.
- contentRules must require realistic domain data and explicitly forbid placeholder content ("Lorem ipsum", "Item 1", "User A", "Test", "Example").
- Prohibit generic output explicitly in "antiPatterns": no default browser form controls, no unstyled tables, no emoji used as interface icons, no inconsistent spacing, no hard-coded colors outside the token list, no automatic dashboard KPI tiles, gradient blobs, glassmorphism, or a list/detail/table pattern for a product whose workflow does not need it.
- Add "visualQaRules" that tell the coding agent how to verify the result: run the product, capture a screenshot per documented state and breakpoint, and compare it against this document.
- Do not add screens, surfaces, or authentication that the feature specifications do not require.
- Stay consistent with the project definition, the feature specifications, and the architecture. If the architecture names a CSS framework or component library, the tokens and components must be implementable in it.

Return JSON:
{
  "overview": "paragraph describing the resulting interface",
  "styleDirection": "the committed visual direction, in one paragraph",
  "creativeConcept": "the product-specific idea the interface is built around",
  "creativeRationale": "why that idea fits this domain, audience, and usage context",
  "themeMode": "light" | "dark" | "both",
  "principles": ["5-7 principles that visibly shape the interface"],
  "signatureMoments": [
    { "name": "…", "description": "the deliberate highlight and why it exists", "screenIds": ["screen-id"] }
  ],
  "fontFamilies": [
    { "family": "…", "source": "legal source", "fallback": "system fallback", "weights": ["400", "600"] }
  ],
  "colorTokens": [{ "name": "--color-primary", "value": "#4f46e5", "usage": "primary actions and selected states" }],
  "typographyScale": [{ "role": "Page title", "size": "24px", "weight": "600", "lineHeight": "1.3", "usage": "top-level screen heading" }],
  "spacingScale": [{ "name": "--space-2", "value": "8px", "usage": "gap inside a control group" }],
  "radiusTokens": [{ "name": "--radius-control", "value": "8px", "usage": "buttons and inputs" }],
  "shadowTokens": [{ "name": "--shadow-card", "value": "0 1px 2px rgba(15,23,42,0.06)", "usage": "resting cards" }],
  "layout": {
    "shell": "how the page frame is composed",
    "navigation": "how the user moves between screens",
    "grid": "container width, columns, gutters",
    "breakpoints": [{ "name": "mobile", "width": "< 640px", "behavior": "single column, navigation collapses" }]
  },
  "platformProfiles": [
    {
      "platform": "web",
      "navigation": "how the user moves between screens on this platform",
      "units": "the measurement units this platform uses",
      "inputModes": ["pointer", "keyboard", "touch"],
      "safeAreas": "the platform insets that constrain the layout",
      "resizing": "how the layout responds to window or device size changes",
      "adaptiveBehavior": "how the layout changes across this platform's size classes"
    }
  ],
  "approvedDependencies": [
    { "name": "lucide-react", "purpose": "interface iconography", "source": "recommended", "platforms": ["web"] }
  ],
  "components": [
    { "name": "Button", "purpose": "trigger an action", "variants": ["primary", "secondary", "ghost", "danger"], "states": ["hover", "focus-visible", "disabled", "loading"], "rules": ["exactly one primary action per screen"] }
  ],
  "screens": [
    {
      "id": "kebab-case",
      "name": "Screen name",
      "featureId": "feature id or empty string",
      "purpose": "what the user achieves on this screen",
      "layout": ["Screen header: title and primary action", "Filter row", "Result list", "Pagination"],
      "components": ["Button", "Table", "EmptyState"],
      "states": ["loading", "empty", "populated", "error"],
      "responsive": ["below 768px the table becomes stacked cards"],
      "sampleContent": ["the sample records this screen must render, using this product's own domain"],
      "assetIds": ["asset id from the asset plan, or empty"]
    }
  ],
  "interactionRules": ["how hover, focus, transitions, destructive actions, and feedback behave"],
  "accessibilityRules": ["contrast, focus rings, labels, keyboard order, target sizes"],
  "contentRules": ["voice, empty-state copy, date and number formatting, required realistic data"],
  "antiPatterns": ["the generic patterns this product must never ship"],
  "visualQaRules": ["how the coding agent verifies the rendered result"]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

VISUAL DIRECTION FROM THE PROJECT
${direction || "(not specified — choose one direction and commit to it)"}

FEATURES
${JSON.stringify(
  features.map((feature) => ({
    id: feature.id,
    name: feature.name,
    purpose: feature.purpose,
    actors: feature.actors,
    mainFlow: feature.mainFlow,
    uiSurfaces: feature.uiSurfaces,
    mediaRequirements: feature.mediaRequirements,
    requirements: feature.requirements.map((requirement) => requirement.id),
  })),
  null,
  2,
)}

ARCHITECTURE DECISIONS
${JSON.stringify(architecture?.decisions ?? [], null, 2)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: asset plan                                                   */
/* ------------------------------------------------------------------ */

export function promptAssetPlan(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  architecture: ArchitectureSpec | null,
  uiDesign: UiDesignSpec | null,
) {
  return {
    system: `${GLOBAL_RULES}

TASK
Write the asset plan: the icons, illustrations, photography, and media the interface needs, where each one comes from, where it is stored, and what happens when it fails. A coding agent implements this document without asking follow-up questions, so every entry must be concrete and legally safe to ship.

RULES
- sourcePolicy must state that assets are free to use, legally licensed, and stored inside the repository. Set freeOnly, legalOnly, and localOnly to true and explain the reasoning in "rationale".
- Only use sources you are confident are real and free: open-source icon libraries, public-domain or free-license illustration libraries, and free-license photography libraries. Never invent a URL, a license, or a vendor.
- "sources" lists every source you use with its id, name, officialUrl, supported assetTypes, a specific license name, whether attribution is required, and any platform restrictions. Never leave the license as unknown, pending, or "verify before use".
- Define exactly one icon system per target platform in the project definition. Each system names the family, size, stroke, fill, optical alignment, colour rule, accessibility rule, and a concrete action → icon-name mapping for the actions the screens use.
- When the design specification approves a UI dependency for icons (for example lucide-react), use that library as the icon family for the matching platforms and map actions to individual icon names from it.
- Define one asset entry per media asset the screens need, and only for real needs: uploaded photography, empty-state illustration, avatar, map, chart, or document preview. Never add decorative assets that explain nothing.
- Every asset entry must contain: kind, purpose, the screen ids it appears on, placement, how it is obtained, the source id, a search query or generation brief, a repository-local destination path with a file name and extension, format, dimensions, aspect ratio, crop and treatment rules, alt text, a documented fallback, platform variants, license, and attribution.
- destinationPath must be a repository-local relative path such as public/assets/..., src/assets/..., ios/.../Assets.xcassets/..., or android/app/src/main/res/... Never use an absolute path, a URL, or a path outside the repository.
- The fallback must be something a coding agent can implement without the asset: an inline placeholder, a neutral icon tile, or a documented text treatment.
- Reference only screen ids that exist in the design specification. Do not create assets for screens that do not exist.
- Keep the plan honest about platform variants: the same asset may need different sizes or formats per platform.

Return JSON:
{
  "strategy": "one paragraph describing how assets are chosen and delivered",
  "sourcePolicy": { "rationale": "why free, legal, local assets", "freeOnly": true, "legalOnly": true, "localOnly": true },
  "iconSystems": [
    {
      "platform": "web",
      "family": "Lucide",
      "size": "20px",
      "stroke": "1.75px",
      "fill": "outlined only",
      "opticalAlignment": "centered on the text baseline with an 8px gap",
      "color": "currentColor mapped to the surrounding text token",
      "accessibility": "decorative icons hidden; action icons carry an accessible label",
      "mappings": [{ "action": "Search", "icon": "Search" }]
    }
  ],
  "sources": [
    {
      "id": "lucide",
      "name": "Lucide",
      "officialUrl": "https://lucide.dev",
      "assetTypes": ["icon"],
      "license": "ISC License",
      "attributionRequired": false,
      "platformRestrictions": ["web"]
    }
  ],
  "assets": [
    {
      "id": "kebab-case",
      "type": "illustration",
      "purpose": "why this asset exists",
      "screenIds": ["screen-id"],
      "placement": "where it appears on the screen",
      "sourceMethod": "how the coding agent obtains it",
      "sourceId": "lucide",
      "query": "search query or generation brief",
      "destinationPath": "public/assets/example.svg",
      "format": "SVG",
      "dimensions": "640x480 px",
      "aspectRatio": "4:3",
      "treatment": "crop and colour rules",
      "altText": "accessible description of the asset",
      "fallback": "what renders when the asset is missing",
      "platformVariants": ["web: single responsive SVG"],
      "license": "ISC License",
      "attribution": "attribution text, or a statement that none is required"
    }
  ]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

FEATURES
${JSON.stringify(
  features.map((feature) => ({
    id: feature.id,
    name: feature.name,
    purpose: feature.purpose,
    uiSurfaces: feature.uiSurfaces,
    mediaRequirements: feature.mediaRequirements,
  })),
  null,
  2,
)}

ARCHITECTURE DECISIONS
${JSON.stringify(architecture?.decisions ?? [], null, 2)}

UI DESIGN
${JSON.stringify(
  uiDesign
    ? {
        styleDirection: uiDesign.styleDirection,
        themeMode: uiDesign.themeMode,
        approvedDependencies: uiDesign.approvedDependencies,
        screens: uiDesign.screens.map((screen) => ({
          id: screen.id,
          name: screen.name,
          featureId: screen.featureId,
          states: screen.states,
        })),
      }
    : "not generated",
  null,
  2,
)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: architecture (PRD §17)                                       */
/* ------------------------------------------------------------------ */

export function promptArchitecture(definition: ProjectDefinition) {
  return {
    system: `${GLOBAL_RULES}

TASK
Recommend the technical architecture using the project requirements and the user's explicit technology decisions.

DECISION SOURCE RULES (critical)
- Every entry in "decisions" carries a "source":
  - "user-selected": the user explicitly chose it (it is already in technicalPreferences with that source, or stated in the idea).
  - "recommended": you chose it because the requirements imply it.
  - "undecided": not decided yet — then "technology" MUST be null.
- Never present your own recommendation as a user decision, and never upgrade an "undecided" entry into a concrete technology.
- Never introduce a specific vendor (Stripe, SendGrid, Twilio, Google Maps, S3, …) unless the project definition asks for it. If a capability is needed but no provider is chosen, list it in "decisions" as component + "undecided" or as a generic capability in "externalServices" with source "recommended".
- Record how interface assets are delivered and optimized when the product has media: bundling strategy, image formats and responsive sizes, icon package, caching, and storage. Keep these as architecture rules rather than design decisions.
- Only add storage, CDN, or media endpoints when the requirements need uploaded or served media.

Also describe: system boundaries (what is inside the product vs outside), the high-level data flow as ordered steps, and the architecture rules the implementation must follow.

Return JSON:
{
  "overview": "paragraph describing the architecture",
  "decisions": [{ "component": "Frontend", "technology": "Next.js" | null, "source": "user-selected" | "recommended" | "undecided", "rationale": "…", "alternatives": ["…"] }],
  "systemBoundaries": { "inside": ["…"], "outside": ["…"] },
  "dataFlow": ["1. step", "2. step"],
  "externalServices": [{ "name": "…", "purpose": "…", "source": "recommended" | "undecided" }],
  "rules": ["architecture rule the implementation must follow"]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: data model (PRD §18)                                         */
/* ------------------------------------------------------------------ */

export function promptDataModel(definition: ProjectDefinition, features: FeatureSpec[]) {
  return {
    system: `${GLOBAL_RULES}

TASK
Design the data model required to implement these features.

RULES
- Use snake_case table names in plural form (e.g. panic_events).
- Every entity lists its fields with a type, what the field is for when it is not obvious, and constraints (required, unique, default, enum values, foreign key).
- Include the identifiers and timestamps a real implementation needs (id, created_at, updated_at) and foreign keys for relationships.
- Relationships use "1:1", "1:N", or "N:M" between entity names that exist in the list.
- Only model what the features require. Do not add entities for excluded scope.
- Every field required by UI screens, API request/response shapes, or feature requirements MUST exist as a canonical entity field. Do not invent a field in UI/API without defining it here — if the need is unclear, downstream stages will emit SPEC_GAP instead.
- Enum-valued fields (status, state) must declare their allowed values in constraints so a canonical enum can be derived; the same enum values must be reused by API and tasks.

Return JSON:
{
  "overview": "paragraph",
  "entities": [
    {
      "name": "panic_events",
      "purpose": "…",
      "fields": [{ "name": "id", "type": "uuid", "purpose": "…", "constraints": ["primary key"] }],
      "notes": "…"
    }
  ],
  "relationships": [{ "from": "users", "to": "complaints", "type": "1:N", "description": "…" }]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

FEATURES
${JSON.stringify(
  features.map((feature) => ({ id: feature.id, name: feature.name, requirements: feature.requirements })),
  null,
  2,
)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: API specification (PRD §19)                                  */
/* ------------------------------------------------------------------ */

export function promptApi(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  dataModel: DataModelSpec | null,
  architecture: ArchitectureSpec | null,
  batch?: { index: number; total: number; label: string; focus: FeatureSpec[] },
) {
  const noApi = architecture?.decisions.find((decision) =>
    decision.component.toLowerCase().includes("backend"),
  );

  const scopeBlock = batch
    ? `\n\nSCOPE OF THIS REQUEST
This is batch ${batch.index} of ${batch.total} (${batch.label}).
${
  batch.focus.length > 0
    ? `Cover ONLY the endpoints required by these features:\n${batch.focus
        .map((feature) => `- ${feature.id}: ${feature.name}`)
        .join("\n")}`
    : "Cover ONLY endpoints that are not tied to a single feature: authentication/session, current user profile, shared reference data, and health checks."
}
Other batches cover the remaining endpoints — do not write them.`
    : "";

  return {
    system: `${GLOBAL_RULES}

TASK
Specify the HTTP API that the frontend and the backend agree on.

RULES
- Only specify an API if the project needs one. If the architecture has no backend component, return { "overview": "…", "authentication": "", "endpoints": [] } and explain why in "overview".
- One endpoint per concrete capability, including read endpoints for lists and detail views.
- All paths MUST use the versioned prefix "/api/v1/…" (never bare "/api/…"). Task generators must reference "operationId", never invent a URL from memory.
- Every endpoint MUST set a stable kebab-case "operationId" (e.g. "getFulfillmentOrders") and list the canonical requirement IDs it implements in "requirementIds".
- "request" and "response" are short JSON-ish sketches (field names and types), not full schemas. Every field named here MUST exist as a canonical entity field or be reported as SPEC_GAP — never invent persistence-free fields like roundingMode/priority without a data-model home.
- Always list realistic error cases with status codes, including unauthenticated, forbidden, not found, and conflict cases.
- Authentication is "required", "optional", or "none".
- featureId must reference a provided feature id, or be an empty string for cross-cutting endpoints.
- Keep each string short: one sentence, no prose paragraphs.

Return JSON:
{
  "overview": "paragraph",
  "authentication": "how requests are authenticated",
  "endpoints": [
    {
      "id": "kebab-case",
      "operationId": "camelCaseOperation",
      "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      "path": "/api/v1/…",
      "purpose": "…",
      "actor": "Cashier",
      "authentication": "required",
      "featureId": "cashier-transaction",
      "requirementIds": ["CASH-001"],
      "request": "{ field: type }",
      "response": "{ field: type }",
      "errors": [{ "status": "401", "meaning": "Unauthorized" }]
    }
  ]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

FEATURES
${JSON.stringify(
  features.map((feature) => ({
    id: feature.id,
    name: feature.name,
    requirements: feature.requirements.map((requirement) => requirement.id),
  })),
  null,
  2,
)}

BACKEND DECISION
${noApi ? `${noApi.component}: ${noApi.technology ?? "undecided"} (${noApi.source})` : "not specified"}

DATA MODEL ENTITIES
${JSON.stringify(dataModel?.entities.map((entity) => entity.name) ?? [], null, 2)}${scopeBlock}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: implementation tasks (PRD §21–25)                            */
/* ------------------------------------------------------------------ */

export interface TaskBatchContext {
  index: number;
  total: number;
  label: string;
  phases: string[];
  features: { id: string; title?: string }[];
  knownTasks: { id: string; title: string }[];
  nextTaskNumber: number;
}

export function promptTasks(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  architecture: ArchitectureSpec | null,
  context?: TaskBatchContext,
  uiDesign: UiDesignSpec | null = null,
  assetPlan: AssetPlanSpec | null = null,
  dataModel: DataModelSpec | null = null,
  api: ApiSpec | null = null,
) {
  const strategy = definition.implementation.strategy;
  const phases = context?.phases ?? allowedPhasesForPrompt(definition, features);
  const batch = context;

  const scopeMarker = batch
    ? `\n\nTASK_BATCH_SCOPE_JSON ${JSON.stringify({
        phases: batch.phases,
        featureIds: batch.features.map((feature) => feature.id),
      })}`
    : "";

  const featureIds = new Set(features.map((feature) => feature.id));
  const scopedScreenIds = new Set(
    (uiDesign?.screens ?? [])
      .filter((screen) => featureIds.has(screen.featureId) || screen.featureId === "")
      .map((screen) => screen.id),
  );


  const strategyRules =
    strategy === "module-first"
      ? `The user explicitly requested a module-first (vertical slice) plan. Group tasks so each feature module is delivered end-to-end (frontend, database, backend, integration, validation) before starting the next module.`
      : `${frontendFirstRules(allowedPhasesForPrompt(definition, features))} Complete the frontend experience before backend implementation. Frontend-phase tasks must work against service/repository interfaces backed by mocks, and must not require a running backend.`;

  const scopeBlock = batch
    ? `\n\nSCOPE OF THIS REQUEST
This is batch ${batch.index} of ${batch.total} (${batch.label}).
Cover ONLY these phases: ${batch.phases.map((phase) => `"${phase}"`).join(", ")}.
Start task ids at TASK-${String(batch.nextTaskNumber).padStart(3, "0")}.
${
  batch.knownTasks.length > 0
    ? `Tasks that already exist (${batch.knownTasks.length} in total; depend on them by id, and never restate them):
${batch.knownTasks
  .slice(-120)
  .map((task) => `- ${task.id}: ${task.title}`)
  .join("\n")}`
    : "No tasks exist yet, so this batch cannot depend on anything."
}
If this batch's phases are already covered by the tasks above, return only the genuinely new work (or an empty list) instead of restating existing tasks.`
    : "";

  return {
    system: `${GLOBAL_RULES}

TASK
Turn the specification into small, executable implementation tasks for a coding agent.

STRATEGY
${strategyRules}
IMPORTANT: This may be one batch of a larger plan. Do not invent phases outside the ones named in the request. Do not repeat tasks that already exist in earlier batches.

RULES
- Every task must be small enough that a coding agent can finish it in one pass. Split large features: list screen, detail screen, form + validation, service layer, and so on.
- Keep each string to one sentence (under about 200 characters), except acceptanceCriteria which must be verifiable Given/When/Then statements.
- "type" is one of: foundation, frontend, backend, database, integration, testing, documentation.
- "dependencies" must be EXPLICIT and reference only task ids that exist in YOUR OWN output or in the list of tasks that already exist. Never reference an id you have not seen. Every task that needs mock infrastructure, database, auth/tenant context, or a prior foundation task MUST list it — never leave dependencies empty when infrastructure is required. The plan executes as a DAG on explicit dependencies, not on phase names.
- "references" may only contain requirement ids taken from the feature specifications above. Every functional requirement must be covered by at least one task.
- "apiOperations" must reference canonical endpoint operationIds (e.g. "getFulfillmentOrders") from the API specification. Never write a raw URL from memory — always reuse the canonical path.
- "contextDocs" lists the documents the agent must read, using this exact vocabulary: docs/PRD.md, docs/features/<feature-id>.md, docs/user-flows.md, docs/ui-design.md, docs/asset-plan.md, docs/architecture.md, docs/data-model.md, docs/api.md, AGENTS.md.
- The first frontend work must be one task that implements the design tokens and the shared component primitives from docs/ui-design.md, before any feature screen is built.
- Every frontend or integration task that renders a screen must list docs/ui-design.md in "contextDocs", and its requirements must include implementing that screen exactly as the design specification describes it: its layout regions, the documented components and their variants, and the documented typography and spacing tokens — not a generic layout.
- Frontend and integration tasks must describe the UI states they have to implement in "uiStates" (loading, empty, populated, error, validation, success, responsive) — only the ones that apply. The design specification lists the states per screen; keep them aligned.
- No task may introduce a color, font size, spacing, component, table, entity, column, enum, or endpoint that is missing from the canonical specification. When something is missing, emit the need in "implementationNotes" as SPEC_GAP instead of inventing it.
- Every frontend or integration task that renders a screen must set "screenIds" to the exact screen ids it implements, taken from the design specification. Never invent a screen id.
- Every task that renders or consumes media must set "assetIds" to the exact asset ids it needs, taken from the asset plan, and must state that the asset is downloaded to its documented local path with its documented fallback.
- Install only the approved UI dependencies named in the design specification, and import only the individual icons that are used.
- Include one testing task that runs the documented visual QA: it captures screenshots for every documented screen and state at each documented breakpoint and fixes every mismatch before completion.
- "goal" is one sentence stating the task outcome. "requirements" are imperative implementation requirements ("use ComplaintService interface", "use mock complaint service during the frontend phase"). "implementationNotes" carry technical hints and SPEC_GAPs. "validationCommands" list relevant checks like "pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build".
- "acceptanceCriteria" are objectively checkable, preferably Given/When/Then (e.g. "Given a marketplace cancellation event for an existing reserved order, When the event is processed, Then reserved_qty decreases atomically and duplicate delivery does not release stock twice"). At least 3 criteria for backend/integration tasks.
- Set "optional": true only for work that the definition explicitly marks as deferred or optional.
- Do not invent scope. Every task must trace back to a feature or to foundation work.

Return JSON:
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "…",
      "goal": "…",
      "type": "frontend",
      "phase": "Frontend Features",
      "featureId": "complaints",
      "dependencies": ["TASK-004"],
      "references": ["COMP-001"],
      "apiOperations": ["getComplaints"],
      "contextDocs": ["docs/features/complaints.md"],
      "requirements": ["…"],
      "implementationNotes": ["…"],
      "uiStates": ["loading", "empty", "error"],
      "screenIds": ["screen-id"],
      "assetIds": ["asset-id"],
      "acceptanceCriteria": ["Given …, When …, Then …"],
      "validationCommands": ["pnpm lint", "pnpm typecheck", "pnpm test"],
      "optional": false
    }
  ]
}`,
    user: `PROJECT (essentials only — full definition already constrained earlier stages)
${JSON.stringify(
  {
    name: definition.name,
    summary: definition.summary,
    platform: definition.platform,
    users: definition.users,
    implementation: definition.implementation,
  },
  null,
  2,
)}

CANONICAL REQUIREMENTS (id + meaning — REFER, never redefine)
${JSON.stringify(
  features.flatMap((feature) =>
    feature.requirements.map((requirement) => ({
      id: requirement.id,
      text: requirement.text,
      featureId: feature.id,
    })),
  ),
  null,
  2,
)}

FEATURES (this batch only)
${JSON.stringify(
  features.map((feature) => ({
    id: feature.id,
    name: feature.name,
    actors: feature.actors,
    requirements: feature.requirements.map((requirement) => requirement.id),
    mainFlow: feature.mainFlow,
  })),
  null,
  2,
)}

CANONICAL API OPERATIONS (this batch only — reference operationId, never invent URLs)
${JSON.stringify(
  (api?.endpoints ?? [])
    .filter((endpoint) => !endpoint.featureId || featureIds.has(endpoint.featureId))
    .map((endpoint) => ({
      operationId: endpoint.operationId || endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      requirementIds: endpoint.requirementIds ?? [],
      featureId: endpoint.featureId,
    })),
  null,
  2,
)}

CANONICAL ENTITIES (reference exact table/field names)
${JSON.stringify(
  (dataModel?.entities ?? []).map((entity) => ({
    name: entity.name,
    fields: entity.fields.map((field) => field.name),
  })),
  null,
  2,
)}

ARCHITECTURE DECISIONS
${JSON.stringify(architecture?.decisions ?? [], null, 2)}

UI DESIGN (scoped to these features)
${JSON.stringify(
  uiDesign
    ? {
        approvedDependencies: uiDesign.approvedDependencies.map((dependency) => dependency.name),
        platforms: uiDesign.platformProfiles.map((profile) => profile.platform),
        screens: uiDesign.screens
          .filter(
            (screen) =>
              featureIds.has(screen.featureId) ||
              screen.featureId === "" ||
              screen.assetIds.length > 0,
          )
          .map((screen) => ({
            id: screen.id,
            name: screen.name,
            featureId: screen.featureId,
            states: screen.states,
            components: screen.components,
            assetIds: screen.assetIds,
          })),
      }
    : "not generated",
  null,
  2,
)}

ASSET PLAN (scoped to these features)
${JSON.stringify(
  assetPlan
    ? {
        assets: assetPlan.assets
          .filter((asset) => asset.screenIds.some((screenId) => scopedScreenIds.has(screenId)))
          .map((asset) => ({ id: asset.id, destinationPath: asset.destinationPath })),
      }
    : "not generated",
  null,
  2,
)}${scopeMarker}${scopeBlock}`,
  };
}

function allowedPhasesForPrompt(definition: ProjectDefinition, features: FeatureSpec[]) {
  if (definition.implementation.strategy === "module-first") {
    return ["Foundation", ...features.map((feature) => feature.name), "Integration", "Testing & Validation"];
  }
  return [...FRONTEND_FIRST_PHASES];
}

/* ------------------------------------------------------------------ */
/* Step: agent instructions (PRD §26)                                 */
/* ------------------------------------------------------------------ */

export function promptAgentInstructions(
  definition: ProjectDefinition,
  tasks: ImplementationTask[],
  architecture: ArchitectureSpec | null,
  design: UiDesignSpec | null,
  assetPlan: AssetPlanSpec | null = null,
) {
  const phases = Array.from(new Set(tasks.map((task) => task.phase)));
  return {
    system: `${GLOBAL_RULES}

TASK
Write AGENTS.md: the global instruction file a coding agent must follow while implementing this project.

Required sections, in this order, with these titles:
1. Project Overview
2. Source of Truth
3. Technology Stack
4. Architecture Rules
5. Implementation Strategy
6. Design System Rules
7. Asset and Visual QA Rules
8. Scope Rules
9. Coding Guidelines
10. Testing Expectations
11. Task Execution Workflow

RULES
- "Implementation Strategy" must state the strategy, the ordered task phases (${phases.join(" → ")}), and the rules the agent must respect.${
      definition.implementation.strategy === "frontend-first"
        ? `
  For frontend-first the section must include these rules verbatim in spirit:
  1. Complete the frontend experience before backend implementation.
  2. Build all required screens and user flows.
  3. Implement loading, empty, error and populated states.
  4. Use mock services when backend functionality is unavailable.
  5. Keep mock implementations behind service interfaces.
  6. Do not implement backend functionality during frontend-only tasks.
  7. Do not expand the product scope beyond the specification.`
        : ""
    }
- "Design System Rules" must make the visual result non-negotiable. It must state that docs/ui-design.md is the only source of visual truth and include rules equivalent to:
  1. Read docs/ui-design.md before writing any interface code.
  2. Implement the design tokens exactly as documented; never hard-code a color, font size, spacing, radius, or shadow that is not in the token list.
  3. Build the shared component primitives before the feature screens, and reuse them instead of writing one-off markup per screen.
  4. Style every element deliberately: no browser default form controls, no unstyled tables, no emoji used as icons, no inconsistent spacing between similar screens.
  5. Implement every state the design specification lists for a screen — loading, empty, populated, error, validation, and success — not only the happy path.
  6. Render realistic domain sample data; never ship placeholder content such as "Lorem ipsum", "Item 1", or "User A".
  7. Follow the documented layout, grid, and breakpoint behaviour, and verify the screen at each breakpoint.
  8. When a screen needs something the design specification does not cover, extend the specification first instead of inventing a one-off style.
  9. Use exactly one icon family per platform as documented in docs/asset-plan.md; never mix icon families and never use emoji as interface icons.
  10. Download or create every required asset and commit it to its documented local path; never hotlink an external asset.
  11. Install only the approved UI dependencies named in the design specification, and import only the individual icons that are used.
  12. Implement the documented fallback for every asset so a failed asset never breaks the layout.
- "Asset and Visual QA Rules" must make the rendered result verifiable. It must state that docs/asset-plan.md is the only source of truth for iconography and media, and include rules equivalent to:
  1. Read docs/asset-plan.md before adding any icon, illustration, photograph, or media element.
  2. Source every asset from an approved free and legal source, store it in the repository at its documented path, and keep its license and attribution note.
  3. Implement the documented fallback for every asset and never hotlink an external file.
  4. Run the product before declaring a task complete, and capture a screenshot for every documented screen and state at each documented breakpoint.
  5. Compare each screenshot with docs/ui-design.md and fix overflow, default controls, placeholders, mixed icons, missing assets, contrast failures, and responsive mismatches.
  6. Report the screenshot evidence for the work that was verified.
- "Source of Truth" explains that the Project Definition drives every document and that documents must be updated together when the definition changes.
- "Scope Rules" restates the non-goals so the agent does not build them.
- Use concrete, imperative rules. No marketing, no vague advice.
- The document is written for an AI coding agent, not for a human manager.

Return JSON:
{
  "title": "AGENTS.md",
  "summary": "one paragraph",
  "sections": [{ "id": "kebab-case", "title": "Project Overview", "blocks": [ { "type": "bullets", "items": ["…"] } ] }]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

ARCHITECTURE
${JSON.stringify(
  {
    decisions: architecture?.decisions ?? [],
    rules: architecture?.rules ?? [],
    boundaries: architecture?.systemBoundaries ?? { inside: [], outside: [] },
  },
  null,
  2,
)}

ASSET PLAN
${JSON.stringify(
  assetPlan
    ? {
        sourcePolicy: assetPlan.sourcePolicy,
        iconSystems: assetPlan.iconSystems.map((system) => ({
          platform: system.platform,
          family: system.family,
          mappings: system.mappings.length,
        })),
        assets: assetPlan.assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          destinationPath: asset.destinationPath,
        })),
      }
    : "not generated",
  null,
  2,
)}

UI DESIGN
${JSON.stringify(
  design
    ? {
        styleDirection: design.styleDirection,
        themeMode: design.themeMode,
        components: design.components.map((component) => component.name),
        screens: design.screens.map((screen) => ({
          id: screen.id,
          name: screen.name,
          featureId: screen.featureId,
          states: screen.states,
        })),
      }
    : "not generated",
  null,
  2,
)}

TASKS (id, phase, type)
${JSON.stringify(
  tasks.map((task) => ({ id: task.id, title: task.title, phase: task.phase, type: task.type })),
  null,
  2,
)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: consistency validation (PRD §28)                             */
/* ------------------------------------------------------------------ */

function extractBusinessRules(prd: SpecDocument | null): string[] {
  const rules: string[] = [];
  for (const section of prd?.sections ?? []) {
    if (!/business rule|edge case|constraint/i.test(section.title)) continue;
    for (const block of section.blocks) {
      if (block.type === "bullets" || block.type === "steps") rules.push(...block.items);
      if (block.type === "paragraph" || block.type === "callout") rules.push(block.text);
    }
  }
  return rules.slice(0, 40);
}

export function buildSpecDigest(input: {
  definition: ProjectDefinition | null;
  features: FeatureSpec[];
  flows: UserFlow[];
  uiDesign: UiDesignSpec | null;
  assetPlan: AssetPlanSpec | null;
  architecture: ArchitectureSpec | null;
  dataModel: DataModelSpec | null;
  api: ApiSpec | null;
  tasks: ImplementationTask[];
  prd: SpecDocument | null;
  agentInstructions: SpecDocument | null;
}) {
  const prdText = (input.prd?.sections ?? [])
    .map((section) => `${section.title}: ${section.blocks.length} blocks`)
    .join("; ");

  return JSON.stringify(
    {
      definition: input.definition,
      prdSections: prdText,
      prdBusinessRules: extractBusinessRules(input.prd),
      features: input.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        requirements: feature.requirements.map((requirement) => ({
          id: requirement.id,
          text: requirement.text,
        })),
        businessRules: feature.businessRules,
        edgeCases: feature.edgeCases,
        acceptanceCriteria: feature.acceptanceCriteria,
        actors: feature.actors,
        mainFlow: feature.mainFlow,
      })),
      flows: input.flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        featureId: flow.featureId,
        trigger: flow.trigger,
        steps: flow.steps,
        outcome: flow.outcome,
      })),
      uiDesign: input.uiDesign
        ? {
            creativeConcept: input.uiDesign.creativeConcept,
            styleDirection: input.uiDesign.styleDirection,
            themeMode: input.uiDesign.themeMode,
            tokens: {
              color: input.uiDesign.colorTokens.length,
              typography: input.uiDesign.typographyScale.length,
              spacing: input.uiDesign.spacingScale.length,
              radius: input.uiDesign.radiusTokens.length,
              shadow: input.uiDesign.shadowTokens.length,
            },
            platformProfiles: input.uiDesign.platformProfiles.map((profile) => profile.platform),
            approvedDependencies: input.uiDesign.approvedDependencies.map((dependency) => ({
              name: dependency.name,
              source: dependency.source,
              platforms: dependency.platforms,
            })),
            components: input.uiDesign.components.map((component) => component.name),
            screens: input.uiDesign.screens.map((screen) => ({
              id: screen.id,
              name: screen.name,
              featureId: screen.featureId,
              states: screen.states,
              assetIds: screen.assetIds,
            })),
            signatureMoments: input.uiDesign.signatureMoments.map((moment) => ({
              name: moment.name,
              screenIds: moment.screenIds,
            })),
          }
        : null,
      assetPlan: input.assetPlan
        ? {
            sourcePolicy: input.assetPlan.sourcePolicy,
            iconSystems: input.assetPlan.iconSystems.map((system) => ({
              platform: system.platform,
              family: system.family,
              mappings: system.mappings.length,
            })),
            sources: input.assetPlan.sources.map((source) => ({
              id: source.id,
              license: source.license,
            })),
            assets: input.assetPlan.assets.map((asset) => ({
              id: asset.id,
              type: asset.type,
              screenIds: asset.screenIds,
              sourceId: asset.sourceId,
              destinationPath: asset.destinationPath,
            })),
          }
        : null,
      architecture: input.architecture?.decisions ?? [],
      architectureRules: input.architecture?.rules ?? [],
      entities: input.dataModel?.entities.map((entity) => ({
        name: entity.name,
        fields: entity.fields.map((field) => ({
          name: field.name,
          type: field.type,
          constraints: field.constraints,
        })),
      })) ?? [],
      relationships: input.dataModel?.relationships ?? [],
      endpoints: input.api?.endpoints.map((endpoint) => ({
        operationId: endpoint.operationId ?? endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        purpose: endpoint.purpose,
        featureId: endpoint.featureId,
        requirementIds: endpoint.requirementIds ?? [],
        request: endpoint.request,
        response: endpoint.response,
      })) ?? [],
      tasks: input.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        goal: task.goal ?? "",
        phase: task.phase,
        type: task.type,
        featureId: task.featureId,
        references: task.references,
        apiOperations: task.apiOperations ?? [],
        dependencies: task.dependencies,
        requirements: task.requirements,
        acceptanceCriteria: task.acceptanceCriteria,
      })),
      agentInstructionSections: input.agentInstructions?.sections.map((section) => section.title) ?? [],
    },
    null,
    2,
  );
}

export function promptValidate(digest: string) {
  return {
    system: `${GLOBAL_RULES}

TASK
You are a software specification consistency auditor. Do not redesign the product. Do not introduce new requirements unless reporting a SPEC_GAP.

Analyze all generated artifacts against the canonical specification (requirement IDs with their texts, entities with fields, endpoints with operationIds/paths, screens).

Validate:
1. Every requirement ID has exactly one semantic meaning (same ID, different text = REQUIREMENT_SEMANTIC_MISMATCH).
2. Every requirement exists in the canonical requirement registry.
3. Every functional requirement has implementation task coverage (Requirement → Flow → API/operation → Task).
4. Every API referenced by UI or task exists (operationId/path).
5. Every entity/table/field referenced by API/task exists in the data model.
6. Every UI-required field has a defined source (else SPEC_GAP, e.g. Product.brand, roundingMode, priority).
7. Every API/domain field has a canonical representation.
8. Enums are consistent across UI/API/feature/DB (e.g. fulfillment statuses).
9. State machines are consistent across artifacts.
10. Task dependencies reference valid tasks and the graph is acyclic with explicit foundational deps.
11. Core user flows have end-to-end implementation coverage (e.g. webhook → ingest → dedupe → reserve → movement → broadcast).
12. No business rule contradicts another artifact (e.g. reserved increment vs decrement, available = on_hand - reserved vs clamp-to-0).
13. No downstream artifact silently introduces a new requirement/entity/endpoint.
14. Acceptance criteria are testable (Given/When/Then preferred).
15. API paths use the canonical /api/v1/ prefix consistently.

CHECK ALSO FOR
- A non-goal implemented anyway; a feature without spec; an endpoint/entity no feature requires.
- A technology decision contradicting user choice; an "undecided" leaking technology.
- A user flow conflicting with a feature main flow; missing screens; design contradicting architecture.
- Assets with missing source/license/path/fallback; generic-template output never requested.

DO NOT REPORT
- Endpoints with an empty featureId: those are cross-cutting by design.
- Requirement ids inside "definition.requirements": plain statements, not ids.
- Prefix mismatches between features: each feature picks its own prefix.
- Anything already listed as a non-goal.

Return structured findings only. Report ONLY real problems you can point to in the data. If consistent, return empty issues. Keep short and specific. Write "summary", "detail", "suggestion" in Indonesian.

Return JSON:
{
  "issues": [
    {
      "id": "kebab-case",
      "severity": "high" | "medium" | "low",
      "area": "scope" | "features" | "tasks" | "api" | "data-model" | "architecture" | "flows",
      "summary": "short Indonesian summary",
      "detail": "what exactly is wrong and where",
      "artifacts": ["prd", "tasks"],
      "suggestion": "what to change"
    }
  ]
}`,
    user: `SPECIFICATION PACKAGE\n${digest}`,
  };
}

/* ------------------------------------------------------------------ */
/* Step: edit with AI (PRD §27)                                       */
/* ------------------------------------------------------------------ */

export const EDIT_TARGETS = [...ARTIFACT_KEYS, "definition"] as const;
export type EditTarget = (typeof EDIT_TARGETS)[number];

export function promptEdit(input: {
  target: EditTarget;
  instruction: string;
  definition: ProjectDefinition | null;
  payload: unknown;
}) {
  const { target, instruction, definition, payload } = input;

  const targetRules: Record<EditTarget, string> = {
    definition: `Update the Project Definition itself. Change only what the instruction requires, keep every other field intact, and keep the structure identical to the input. Return the FULL updated definition.`,
    architecture: `Update the architecture specification. Obey the decision-source rules: never turn a user decision into a recommendation, and never invent a vendor the definition does not allow.`,
    prd: `Update only the PRD document. Keep the required section structure and keep it consistent with the project definition.`,
    features: `Update the feature specifications with a delta. Put every added or changed full feature under "featureChanges.upsert" and explicit deleted feature IDs under "featureChanges.removeIds"; omit unchanged items. Keep requirement ids stable unless the change makes an id wrong; never renumber ids that other documents already reference.`,
    flows: `Update the user flows. Return the FULL list of flows.`,
    uiDesign: `Update the UI design specification. Return the whole specification. Keep token names stable, keep every screen that is not affected exactly as it is, and keep the design implementable with the stack recorded in the definition.`,
    assetPlan: `Update the asset plan. Return the whole plan. Keep asset ids stable, keep every source legally safe and free, keep destination paths repository-local, and keep every asset attached to a screen that exists in the UI design.`,
    dataModel: `Update the data model. Return the full entity and relationship list.`,
    api: `Update the API specification. Keep endpoint paths stable unless the instruction requires otherwise.`,
    tasks: `Update the implementation task list with a delta. Put every added or changed full task under "taskChanges.upsert" and explicit deleted task IDs under "taskChanges.removeIds"; omit unchanged items. Keep dependency and reference ids pointing at tasks and requirements that still exist, and never break the phase order of the implementation strategy.`,
    agentInstructions: `Update AGENTS.md. Keep all required sections and keep it consistent with the project definition and the task phases.`,
  };

  const responseShape: Record<EditTarget, string> = {
    definition: `{ "summary": "…", "affected": ["prd", "features"], "definition": { …full definition… } }`,
    prd: `{ "summary": "…", "affected": [], "document": { "title": "…", "summary": "…", "sections": [ … ] } }`,
    features: `{ "summary": "…", "affected": [], "featureChanges": { "upsert": [ …full added or changed features… ], "removeIds": ["feature-id"] } }`,
    flows: `{ "summary": "…", "affected": [], "flows": [ … ] }`,
    uiDesign: `{ "summary": "…", "affected": [], "uiDesign": { … } }`,
    assetPlan: `{ "summary": "…", "affected": [], "assetPlan": { … } }`,
    architecture: `{ "summary": "…", "affected": [], "architecture": { … } }`,
    dataModel: `{ "summary": "…", "affected": [], "dataModel": { … } }`,
    api: `{ "summary": "…", "affected": [], "api": { … } }`,
    tasks: `{ "summary": "…", "affected": [], "taskChanges": { "upsert": [ …full added or changed tasks… ], "removeIds": ["TASK-001"] } }`,
    agentInstructions: `{ "summary": "…", "affected": [], "document": { … } }`,
  };

  return {
    system: `${GLOBAL_RULES}

TASK
Apply one natural-language change request to the specification package.

LANGUAGE OVERRIDE
"summary" is shown to the user, who communicates in Indonesian: write it in Indonesian, in one or two sentences, describing exactly what changed. Everything inside the specification content stays in English.

RULES
- ${targetRules[target]}
- Never change anything the instruction does not ask for.
- Never introduce scope that contradicts the non-goals in the definition.
- If the instruction contradicts an explicit user decision, follow the instruction and record the change.
- For the definition target: "affected" lists the artifacts that must be regenerated for consistency, chosen from: prd, features, flows, uiDesign, assetPlan, architecture, dataModel, api, tasks, agentInstructions.

Return JSON exactly in this shape:
${responseShape[target]}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

CURRENT ${target.toUpperCase()}
${JSON.stringify(payload, null, 2)}

USER INSTRUCTION
"""${instruction.trim()}"""`,
  };
}
