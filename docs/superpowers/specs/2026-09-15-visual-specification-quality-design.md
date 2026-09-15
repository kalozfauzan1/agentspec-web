# Visual Specification Quality Design

## Goal

Make every AgentSpec export give a coding agent enough concrete visual direction, approved UI dependencies, asset requirements, and verification rules to build a polished product rather than a generic interface.

## Existing Foundation

The current uncommitted work already adds visual intent to the Project Definition, a structured UI Design artifact, design tokens, component and screen specifications, Markdown export, workspace presentation, task references, agent rules, and initial consistency checks. This design extends that work rather than replacing it.

Known gaps in the current foundation:

- UI tasks mention `docs/ui-design.md` but the task prompt does not receive the generated UI Design.
- Tasks do not depend on UI Design, and UI Design is generated before Architecture even though it needs platform and framework decisions.
- There is no structured plan for icons, images, illustrations, media treatment, sources, licenses, attribution, local paths, or fallbacks.
- The demo generator always adds sign-in and gives every feature list/detail/table surfaces, even when requirements do not call for them.
- One visual clarification question is expected to capture style, theme, density, references, and media choices at once.
- The schema and generated guidance are web-centric and do not define platform-specific behavior.
- Export remains available when high-severity visual issues exist.

## Decisions

- Produce two visual documents: `docs/ui-design.md` and `docs/asset-plan.md`.
- Infer one product-specific art direction when the user provides little visual guidance. Do not fall back to a universal dashboard preset.
- Support every platform named by the project, including web, iOS, Android, and desktop.
- Prefer free, legal, locally stored assets with explicit license and attribution metadata.
- Allow approved plugins and libraries when they solve a documented need. Record whether each dependency was user-selected or recommended.
- Require visual QA by the coding agent before frontend work is considered complete.
- Preserve existing persisted AgentSpec projects by adding defaulted fields instead of invalidating the current schema shape.

## Generation Architecture

```text
Idea and visual intent
  -> Clarification
  -> Project Definition
  -> Features and Architecture
  -> UI Design
  -> Asset Plan and visual-readiness review
  -> Tasks
  -> Agent Instructions
  -> Package consistency validation
  -> Export
```

UI Design depends on Features and Architecture. Asset Plan depends on UI Design. Tasks depend on Architecture, UI Design, and Asset Plan. Agent Instructions receive both visual documents and the generated tasks.

## Visual Intent

The Project Definition keeps the current `style`, `themeMode`, `references`, and `notes` fields and adds defaulted fields for personality, audience context, desired emotion, information density, media preferences, brand constraints, and visual patterns to avoid.

Clarification is adaptive. It asks visual questions only when the answers materially affect the product. If the user does not answer, the definition generator selects a coherent direction based on product domain, audience, usage context, and platform, and records the rationale.

## UI Design Contract

`docs/ui-design.md` is the source of truth for:

- creative concept and rationale;
- two or three product-specific signature visual moments;
- font families, legal source, fallbacks, weights, and semantic type roles;
- semantic color, spacing, radius, elevation, grid, density, and motion tokens;
- platform profiles, navigation conventions, units, input modes, safe areas, resizing, and responsive or adaptive behavior;
- approved UI dependencies such as an icon library, chart library, map SDK, animation package, or component primitives;
- component anatomy, variants, states, token references, usage, anti-usage, and platform notes;
- screens with stable IDs, feature ownership, hierarchy, ordered layout regions, realistic content, interactions, states, asset IDs, platform adaptations, and acceptance criteria;
- accessibility, content, interaction, anti-pattern, and visual-QA rules.

The generator must not automatically add authentication, sidebars, dashboards, KPI cards, tables, CRUD list/detail screens, gradient blobs, glassmorphism, excessive rounded containers, or icons inside decorative tiles. These patterns are allowed only when product requirements and usage context justify them.

## Asset Plan Contract

`docs/asset-plan.md` is the source of truth for iconography and media sourcing. It contains:

- an asset strategy and free/legal source policy;
- one coherent icon family per target platform;
- icon size, stroke, fill, optical alignment, color, and accessibility rules;
- concrete icon-name mappings for documented actions and navigation;
- a curated source catalog with official URL, asset types, license, attribution requirement, and platform restrictions;
- asset entries with stable ID, type, purpose, screen placement, source method, source ID, search query or generation brief, destination path, format, dimensions, aspect ratio, crop, treatment, alt text, fallback, platform variants, license, and attribution;
- performance, local-storage, optimization, and failure rules.

The coding agent downloads assets into the repository instead of hotlinking them. Unknown sources remain `verify-before-use` and block visual readiness until their license is checked.

For a React or Next.js project, an approved dependency may be `lucide-react`. UI Design defines its visual rules, Asset Plan maps semantic actions to individual Lucide icon names, Architecture records the dependency decision, and Tasks instruct the agent to import only icons that are used. Other platforms use compatible choices, such as `lucide-react-native`, SF Symbols under its Apple platform restrictions, or Material Symbols when appropriate.

## Cross-Document Rules

- PRD records experience outcomes and visual constraints without becoming an implementation manual.
- Feature specifications record whether a feature is user-facing, its UI surfaces, and its media requirements.
- Architecture records approved libraries, delivery, optimization, caching, and storage decisions.
- Data Model and API include media fields or endpoints only when the product supports user-managed media.
- Frontend tasks reference concrete screen IDs and asset IDs.
- `AGENTS.md` requires both visual documents to be read before interface code is written.
- Editing visual intent marks UI Design, Asset Plan, Tasks, and Agent Instructions stale.

## Visual Readiness

Deterministic checks validate IDs, feature ownership, source metadata, licenses, paths, platform coverage, screen states, task references, and orphan screens or assets. An AI visual critic evaluates domain fit, distinctiveness, hierarchy, consistency, content realism, purposeful imagery, and generic-template patterns.

The system performs at most one targeted repair pass. Remaining high-severity issues fail Asset Plan generation and block Tasks, Agent Instructions, and Markdown export. Medium and low issues remain visible as warnings. Project JSON export remains available for backup and recovery.

## Coding-Agent Visual QA

Generated tasks and `AGENTS.md` require the coding agent to:

1. Build tokens and shared primitives before feature screens.
2. Install only approved UI dependencies.
3. Download or create every required asset at its documented local path.
4. Implement every relevant state with realistic domain content.
5. Run the product and inspect each target platform and viewport.
6. Capture screenshots using browser automation, simulators, or desktop window sizes as appropriate.
7. Compare hierarchy, composition, typography, iconography, media placement, and adaptive behavior with the specification.
8. Fix overflow, broken media, placeholders, mixed icon families, default controls, contrast failures, and responsive mismatches before completion.

## Error Handling

Each generated artifact is persisted when it succeeds. A failed visual review retains earlier artifacts and exposes a focused regenerate action. Normalization keeps stable IDs and deduplicates entries. Missing optional media does not fail a screen when an intentional fallback is documented; missing required assets or unresolved licensing does.

## Testing

- Schema tests cover existing project compatibility and new defaults.
- UI Design tests cover platform profiles, signature direction, requirement-derived screens, and absence of invented authentication.
- Asset Plan tests cover icon systems, source metadata, local paths, licenses, fallbacks, and screen references.
- Pipeline tests cover generation order, dependency blocking, and actual UI Design and Asset Plan data passed to task generation.
- Export tests cover both Markdown documents, starter prompt, tasks, and agent instructions.
- Validation tests cover high-severity blocking and non-blocking warnings.
- End-to-end verification generates representative web, mobile, and desktop projects and inspects the exported package.
