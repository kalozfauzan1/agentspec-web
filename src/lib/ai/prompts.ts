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
  type ImplementationTask,
  type ProjectDefinition,
  type SpecDocument,
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
7. Answer with valid JSON only. No markdown fences, no commentary, no trailing text.`;

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
Analyse the software idea and extract a structured understanding of it. Detect product type, purpose, platform, target users, roles, core features, business rules, integrations, explicit technical preferences, constraints, explicit exclusions, and the ambiguities that genuinely block implementation.

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
- Map each question to one category from: users, roles-permissions, business-flow, feature-behavior, platform, integrations, payment, data, technical.
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
      "acceptanceCriteria": ["…"]
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
- "request" and "response" are short JSON-ish sketches (field names and types), not full schemas.
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
      "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      "path": "/api/…",
      "purpose": "…",
      "actor": "Cashier",
      "authentication": "required",
      "featureId": "cashier-transaction",
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
  knownTasks: { id: string; title: string }[];
  nextTaskNumber: number;
}

export function promptTasks(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  architecture: ArchitectureSpec | null,
  context?: TaskBatchContext,
) {
  const strategy = definition.implementation.strategy;
  const phases = context?.phases ?? allowedPhasesForPrompt(definition, features);
  const batch = context;

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
- Keep each string to one sentence (under about 200 characters).
- "type" is one of: foundation, frontend, backend, database, integration, testing, documentation.
- "dependencies" may only reference task ids that exist in YOUR OWN output or in the list of tasks that already exist. Never reference an id you have not seen.
- "references" may only contain requirement ids taken from the feature specifications above.
- "contextDocs" lists the documents the agent must read, using this exact vocabulary: docs/PRD.md, docs/features/<feature-id>.md, docs/user-flows.md, docs/architecture.md, docs/data-model.md, docs/api.md, AGENTS.md.
- Frontend and integration tasks must describe the UI states they have to implement in "uiStates" (loading, empty, populated, error, validation, success, responsive) — only the ones that apply.
- "requirements" are imperative implementation requirements ("use ComplaintService interface", "use mock complaint service during the frontend phase").
- "acceptanceCriteria" are objectively checkable.
- Set "optional": true only for work that the definition explicitly marks as deferred or optional.
- Do not invent scope. Every task must trace back to a feature or to foundation work.

Return JSON:
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "…",
      "type": "frontend",
      "phase": "Frontend Features",
      "featureId": "complaints",
      "dependencies": ["TASK-004"],
      "references": ["COMP-001"],
      "contextDocs": ["docs/features/complaints.md"],
      "requirements": ["…"],
      "uiStates": ["loading", "empty", "error"],
      "acceptanceCriteria": ["…"],
      "optional": false
    }
  ]
}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

FEATURES
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

ARCHITECTURE DECISIONS
${JSON.stringify(architecture?.decisions ?? [], null, 2)}${scopeBlock}`,
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
6. Scope Rules
7. Coding Guidelines
8. Testing Expectations
9. Task Execution Workflow

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

export function buildSpecDigest(input: {
  definition: ProjectDefinition | null;
  features: FeatureSpec[];
  flows: UserFlow[];
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
      features: input.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        requirements: feature.requirements.map((requirement) => requirement.id),
        actors: feature.actors,
      })),
      flows: input.flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        featureId: flow.featureId,
        steps: flow.steps.length,
      })),
      architecture: input.architecture?.decisions ?? [],
      entities: input.dataModel?.entities.map((entity) => ({
        name: entity.name,
        fields: entity.fields.map((field) => field.name),
      })) ?? [],
      endpoints: input.api?.endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        featureId: endpoint.featureId,
      })) ?? [],
      tasks: input.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        phase: task.phase,
        type: task.type,
        featureId: task.featureId,
        references: task.references,
        dependencies: task.dependencies,
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
You are the consistency validator. Compare the generated specification package against the project definition and report contradictions, missing coverage, and scope violations.

CHECK FOR
- A non-goal that is implemented anyway (a feature, endpoint, entity, or task that clearly provides it).
- A feature without specification, or a specification without a feature.
- An endpoint or entity that no feature requires.
- A task that references a requirement id that does not exist, or a feature that no task implements.
- A technology decision that contradicts an explicit user choice, or an "undecided" item that leaked a concrete technology.
- A user flow that conflicts with a feature's main flow.
- Real coverage gaps: an MVP feature with no task at all, or a feature whose acceptance criteria cannot be verified.
- A struct between documents: for example the architecture promises password hashes or a login endpoint but the data model has no such column, or a task depends on a document that does not exist.

DO NOT REPORT
- Endpoints with an empty featureId: those are cross-cutting by design (authentication, health, reference data).
- Requirement ids inside "definition.requirements": those entries are plain statements, not ids. Feature requirement ids (like MENU-001) are generated per feature and do not need to exist in the definition.
- Prefix mismatches between features: each feature picks its own prefix on purpose.
- Anything that is already listed as a non-goal in the definition.

Report ONLY real problems you can point to in the data. If the package is consistent, return an empty issues array. Keep the report short and specific. Write "summary", "detail", and "suggestion" in Indonesian, because this report is shown to the user.

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
    prd: `Update only the PRD document. Keep the required section structure and keep it consistent with the project definition.`,
    features: `Update the feature specifications. Return the FULL list of features with every other feature preserved. Keep requirement ids stable unless the change makes an id wrong; never renumber ids that other documents already reference.`,
    flows: `Update the user flows. Return the FULL list of flows.`,
    architecture: `Update the architecture specification. Obey the decision-source rules: never turn a user decision into a recommendation, and never invent a vendor the definition does not allow.`,
    dataModel: `Update the data model. Return the full entity and relationship list.`,
    api: `Update the API specification. Keep endpoint paths stable unless the instruction requires otherwise.`,
    tasks: `Update the implementation task list. Return the full list. Keep dependency and reference ids pointing at tasks and requirements that still exist, and never break the phase order of the implementation strategy.`,
    agentInstructions: `Update AGENTS.md. Keep all required sections and keep it consistent with the project definition and the task phases.`,
  };

  const responseShape: Record<EditTarget, string> = {
    definition: `{ "summary": "…", "affected": ["prd", "features"], "definition": { …full definition… } }`,
    prd: `{ "summary": "…", "affected": [], "document": { "title": "…", "summary": "…", "sections": [ … ] } }`,
    features: `{ "summary": "…", "affected": [], "features": [ … ] }`,
    flows: `{ "summary": "…", "affected": [], "flows": [ … ] }`,
    architecture: `{ "summary": "…", "affected": [], "architecture": { … } }`,
    dataModel: `{ "summary": "…", "affected": [], "dataModel": { … } }`,
    api: `{ "summary": "…", "affected": [], "api": { … } }`,
    tasks: `{ "summary": "…", "affected": [], "tasks": [ … ] }`,
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
- For the definition target: "affected" lists the artifacts that must be regenerated for consistency, chosen from: prd, features, flows, architecture, dataModel, api, tasks, agentInstructions.

Return JSON exactly in this shape:
${responseShape[target]}`,
    user: `PROJECT DEFINITION\n${JSON.stringify(definition, null, 2)}

CURRENT ${target.toUpperCase()}
${JSON.stringify(payload, null, 2)}

USER INSTRUCTION
"""${instruction.trim()}"""`,
  };
}
