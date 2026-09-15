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

---

# Running the AgentSpec application

This repository also contains the working MVP implementation of AgentSpec (Next.js App Router).

```bash
npm install
cp .env.example .env.local   # optional: only needed for live AI generation
npm run dev                  # http://localhost:3000
npm run build && npm start   # production build
npm run typecheck            # TypeScript only
```

## How generation works

- **Demo mode** (default when no API key is configured) derives the whole package
  deterministically from the user's idea, so the full workflow, workspace, and export
  can be used without credentials.
- **Live mode** calls an OpenAI-compatible endpoint. Configure it in `.env.local`
  (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) or from the in-app `/settings` page,
  which stores the override in the browser only.

Documents are always generated in English so coding agents receive consistent
terminology; the clarification questions, change summaries, and consistency report
are written in Indonesian.

## Architecture

```text
src/app                     routes: new project, project flow, workspace, settings, API
src/components/ui           design system primitives (Tailwind v4 tokens)
src/components/shell        app header + workspace shell (sidebar, header, AI command bar)
src/components/spec         structured document renderers
src/lib/schemas             Zod models for every generated artifact (the source of truth)
src/lib/ai                  provider client, step prompts, JSON parsing, normalizers, demo generator
src/lib/pipeline            progressive generation runner (per-step persistence, retry, skip)
src/lib/validation          deterministic consistency checks
src/lib/export              deterministic Markdown rendering + ZIP/JSON export
src/lib/db                  IndexedDB persistence
src/lib/store               Zustand stores (settings, projects)
```

Key invariants that keep the package consistent (PRD §10, §27, §28, §34):

1. The Project Definition is the only source of truth; Markdown is a rendering of it.
2. Every AI response is validated against a schema before it enters state.
3. Task dependencies, requirement references, phases, and decision sources are
   normalized deterministically instead of being trusted from the model.
4. Each artifact is persisted as soon as it finishes, so a failed step never discards
   completed work.
5. A consistency pass (structural checks + AI review) runs after generation and is
   surfaced on the project overview.
6. Every package carries `docs/ui-design.md` — visual direction, design tokens, a
   component inventory, and every screen with its layout, states, and sample content.
   Frontend tasks, `AGENTS.md`, and the starter prompt all point at it, so a coding
   agent implements a documented interface instead of styling screens ad hoc.
7. Every package also carries `docs/asset-plan.md` — one icon system per target
   platform, media placements, approved free and legal sources, licenses, local
   paths, and per-asset fallbacks. Visual rules are cross-checked between the two
   documents, and the Markdown ZIP export is blocked while a visual artifact is
   missing or a high-severity consistency issue is open.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AI_BASE_URL` | OpenAI-compatible base URL (default `https://9router.nalarlabs.tech/v1`) |
| `AI_API_KEY` | API key; when empty the app runs in Demo mode |
| `AI_MODEL` | Model name (default `first`) |

`OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are read as fallbacks.
