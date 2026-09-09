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

## Implementation Approach

Before coding, inspect all UI images and derive shared layout primitives/components from them rather than implementing every screen independently.

Keep the first implementation focused on the complete MVP user flow and coherent UI states rather than adding infrastructure outside the PRD.
