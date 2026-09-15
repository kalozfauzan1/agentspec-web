# Coding Agent Brief — Build AgentSpec MVP

Implement the AgentSpec MVP described in `PRD.md` and visually guided by `docs/ui/`.

## Source Priority

When sources disagree, use this priority:

1. `PRD.md` — functional source of truth.
2. `docs/UI_REFERENCE.md` — interpretation rules for screenshots.
3. `docs/ui/*.png` — visual/layout source of truth.

## Product Boundary

Do not add:

- authentication,
- subscriptions or billing,
- teams or collaboration,
- cloud project storage,
- GitHub/GitLab integrations,
- embedded code execution,
- an embedded coding agent,
- task scheduling/assignment/comments/sprints,
- analytics dashboards.

## Core MVP Flow

```text
New Project
→ Dynamic Clarification
→ Project Review
→ Generate Specification
→ Specification Workspace
→ Tasks
→ AGENTS.md
→ Export
```

## Important Product Rules

- Project Definition is the structured source of truth.
- Validate AI-generated application state using schemas.
- Generated documents must stay consistent with Project Definition.
- Preserve explicit user decisions.
- Mark AI-selected technologies as `Recommended`.
- Keep unresolved choices `Undecided`.
- Task planner is frontend-first by default.
- Use module-first only when the user explicitly requests it.
- Frontend-phase tasks must work with mock service/repository abstractions rather than requiring the backend.
- Export must remain generic and coding-agent neutral.
- Projects persist locally in IndexedDB for MVP.
- `docs/ui-design.md` is the only source of visual truth; `docs/asset-plan.md` is the only source for icons and media.
- The UI design defines one behavior profile per target platform and one approved UI dependency list; never mix icon families or install unapproved libraries.
- Every asset comes from an approved free and legal source, is stored in the repository at its documented path, and has an implemented fallback.
- Frontend work is not complete until the coding agent runs the product and verifies screenshots against the design at each documented breakpoint.

## Implementation Approach

Before coding, inspect all UI images and derive shared layout primitives/components from them rather than implementing every screen independently.

Keep the first implementation focused on the complete MVP user flow and coherent UI states rather than adding infrastructure outside the PRD.

## Visual Output Contract

Two generated documents drive the visual result and must stay consistent with each other:

- `docs/ui-design.md` — creative concept, signature moments, font families, semantic tokens, layout and grid, one platform profile per target, approved UI dependencies, component inventory, and every screen with its layout, states, asset references, and responsive behavior.
- `docs/asset-plan.md` — icon systems per platform, media placements, curated free/legal sources with licenses, repository-local destination paths, and per-asset fallbacks.

Frontend and integration tasks reference concrete screen ids and asset ids, and a dedicated visual QA task requires screenshots for every documented screen and state at each documented breakpoint. The Markdown ZIP export stays disabled while a visual artifact is missing or a high-severity consistency issue remains open.
