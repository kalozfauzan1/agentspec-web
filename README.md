# AgentSpec MVP Starter

This repository package contains the source-of-truth MVP PRD and the approved visual UI references for AgentSpec.

## Start Here

1. Read [`PRD.md`](./PRD.md) completely before writing implementation code.
2. Read [`docs/UI_REFERENCE.md`](./docs/UI_REFERENCE.md) to understand how the supplied screenshots should be interpreted.
3. Use the screenshots in [`docs/ui/`](./docs/ui/) as the visual/layout reference.
4. When the screenshots and PRD disagree about functionality, **PRD.md wins**.

## Product in One Sentence

AgentSpec turns a software idea into a structured, coding-agent-ready package containing a PRD, feature specs, technical specs, implementation tasks, and AGENTS.md.

## MVP Boundary

The MVP intentionally does **not** include login, subscription, billing, team collaboration, cloud project storage, GitHub integration, an embedded coding agent, or project-management features.

## Default Task Planning Rule

Implementation tasks are **frontend-first by default**.

Only switch to module-first / vertical-slice task planning when the user's request explicitly asks for it.

## UI Reference Files

- `docs/ui/01-new-project.png`
- `docs/ui/02-clarification.png`
- `docs/ui/03-project-review.png`
- `docs/ui/04-prd-workspace.png`
- `docs/ui/05-feature-specification.png`
- `docs/ui/06-technical-architecture.png`
- `docs/ui/07-implementation-tasks.png`
- `docs/ui/08-export-specification.png`

## Guidance for Coding Agents

Treat this repository as a product specification package, not an existing implementation.

Before coding:

- identify the minimum application architecture required by the PRD,
- preserve the approved UI visual language,
- model AI-generated state as structured validated data,
- use local persistence for MVP projects,
- do not add out-of-scope SaaS functionality,
- do not infer project-management features from decorative screenshot elements.
