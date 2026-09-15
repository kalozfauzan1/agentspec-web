# Visual Specification Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AgentSpec with a platform-aware UI Design and legal Asset Plan that make coding-agent output visually distinctive, asset-complete, and verifiable.

**Architecture:** Preserve the current UI Design work, add Asset Plan as a second structured artifact, and make both mandatory inputs to frontend task planning. Run deterministic and AI visual-readiness checks before tasks, then enforce the same contracts in Markdown export, `AGENTS.md`, and visual QA tasks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Zustand, IndexedDB, Tailwind CSS, Playwright, JSZip.

---

### Task 1: Lock the visual contracts with failing tests

**Files:**
- Modify: `tests/ui-design.spec.ts`
- Modify: `tests/task-generation.spec.ts`
- Create: `tests/asset-plan.spec.ts`

- [ ] Add schema-compatibility coverage for records created before Asset Plan and the richer visual fields.
- [ ] Add tests proving screens come from feature UI surfaces and sign-in is absent without an authentication requirement.
- [ ] Add tests for platform profiles, signature moments, approved dependencies, asset source metadata, licenses, local paths, fallbacks, and screen references.
- [ ] Add task-generation coverage proving the prompt receives concrete screen and asset IDs.
- [ ] Run `npx playwright test tests/ui-design.spec.ts tests/asset-plan.spec.ts tests/task-generation.spec.ts` and confirm the new assertions fail for the intended missing behavior.

### Task 2: Extend visual intent and artifact schemas

**Files:**
- Modify: `src/lib/schemas/definition.ts`
- Modify: `src/lib/schemas/artifacts.ts`
- Modify: `src/lib/schemas/project.ts`
- Modify: `src/lib/store/project-store.ts`

- [ ] Add defaulted visual-intent fields while retaining the current persisted shape.
- [ ] Add user-facing, UI-surface, and media-requirement fields to feature specifications.
- [ ] Enrich UI Design with creative concept, rationale, signature moments, font families, platform profiles, approved dependencies, anti-patterns, visual QA, and richer component and screen references.
- [ ] Add `AssetPlanSpec`, asset source, icon system, asset entry, platform variant, and license schemas.
- [ ] Add `screenIds` and `assetIds` to implementation tasks.
- [ ] Register `assetPlan` in project artifacts, statuses, metadata, and project creation defaults.
- [ ] Run the focused tests and `npm run typecheck`.

### Task 3: Generate product-specific UI Design

**Files:**
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/steps.ts`
- Modify: `src/lib/ai/normalize.ts`
- Modify: `src/lib/ai/demo.ts`

- [ ] Replace the single overloaded visual question rule with adaptive visual clarification.
- [ ] Infer a concrete product-specific direction when user input is sparse.
- [ ] Pass Architecture into UI Design generation and produce target-platform profiles.
- [ ] Require approved UI dependencies, signature moments, explicit anti-patterns, and screen-level visual acceptance criteria.
- [ ] Normalize stable component and screen IDs plus valid cross-references.
- [ ] Replace unconditional sign-in and list/detail/table demo output with surfaces derived from feature requirements.
- [ ] Run focused tests and verify no generic surface is invented.

### Task 4: Add legal asset sourcing and visual critique

**Files:**
- Create: `src/lib/assets/catalog.ts`
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/steps.ts`
- Modify: `src/lib/ai/normalize.ts`
- Modify: `src/lib/ai/demo.ts`
- Modify: `src/lib/validation/checks.ts`

- [ ] Define curated free/legal source metadata with official URLs, license rules, attribution requirements, and platform restrictions.
- [ ] Add Asset Plan generation from Project Definition, Features, Architecture, and UI Design.
- [ ] Map approved icon libraries to concrete semantic icon names and require individual imports where supported.
- [ ] Normalize asset IDs, paths, source IDs, formats, placements, variants, and fallbacks.
- [ ] Add deterministic visual-readiness checks and an AI critic for domain fit, distinctiveness, hierarchy, content realism, and generic-template patterns.
- [ ] Perform at most one repair pass and fail the artifact when high-severity issues remain.
- [ ] Run Asset Plan and validation tests.

### Task 5: Correct pipeline dependencies and task inputs

**Files:**
- Modify: `src/lib/pipeline/run.ts`
- Modify: `src/lib/ai/steps.ts`
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/normalize.ts`
- Modify: `src/lib/store/project-store.ts`
- Modify: `tests/task-generation.spec.ts`

- [ ] Order Architecture before UI Design and Asset Plan before Tasks.
- [ ] Make Tasks depend on and receive Architecture, UI Design, and Asset Plan.
- [ ] Make Agent Instructions receive both visual artifacts.
- [ ] Require frontend tasks to reference documented screen and asset IDs plus both visual context files.
- [ ] Mark downstream visual artifacts stale when visual intent changes.
- [ ] Verify a failed Asset Plan skips Tasks and Agent Instructions without deleting completed artifacts.

### Task 6: Render and export both visual documents

**Files:**
- Modify: `src/lib/export/markdown.ts`
- Modify: `src/lib/export/package.ts`
- Modify: `tests/ui-design.spec.ts`
- Modify: `tests/asset-plan.spec.ts`

- [ ] Expand `renderUiDesign` for creative direction, platform profiles, approved dependencies, component anatomy, asset references, anti-patterns, and visual QA.
- [ ] Add `renderAssetPlan` with icon mappings, source/license tables, per-asset implementation briefs, local paths, fallbacks, and attribution.
- [ ] Add `docs/asset-plan.md` to package files, package README, task contexts, and starter prompt.
- [ ] Verify exported Markdown contains no proprietary AgentSpec syntax and all cross-references resolve.

### Task 7: Present visual intent and Asset Plan in the workspace

**Files:**
- Modify: `src/app/project/[projectId]/review/page.tsx`
- Modify: `src/app/project/[projectId]/(workspace)/design/page.tsx`
- Create: `src/app/project/[projectId]/(workspace)/assets/page.tsx`
- Modify: `src/app/project/[projectId]/(workspace)/page.tsx`
- Modify: `src/app/project/[projectId]/(workspace)/export/page.tsx`
- Modify: `src/components/shell/workspace-shell.tsx`

- [ ] Add review controls for audience, emotion, density, media preferences, brand constraints, and avoid-list.
- [ ] Show creative concept, signature moments, platform profiles, approved dependencies, and richer screen contracts on UI Design.
- [ ] Add an Asset Plan page for icon systems, source/license status, destination paths, placements, fallbacks, and attribution.
- [ ] Add navigation, artifact status, regeneration, and edit-with-AI targeting for Asset Plan.
- [ ] Disable Markdown ZIP export for missing visual artifacts or high-severity validation issues while retaining JSON backup.

### Task 8: Propagate visual requirements across generated documents

**Files:**
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/demo.ts`
- Modify: `src/lib/export/markdown.ts`
- Modify: `src/lib/validation/checks.ts`

- [ ] Add experience outcomes and visual constraints to PRD generation.
- [ ] Add UI surfaces and media needs to feature generation.
- [ ] Add approved dependencies and asset delivery rules to Architecture.
- [ ] Add Design System, Asset, and Visual QA rules to `AGENTS.md`.
- [ ] Include complete visual data in consistency validation and edit propagation.
- [ ] Verify technical documents only introduce media data or endpoints when requirements need them.

### Task 9: Update project documentation and verify end to end

**Files:**
- Modify: `PRD.md`
- Modify: `README.md`
- Modify: `CODING_AGENT_BRIEF.md`

- [ ] Document the two visual artifacts, approved dependency policy, legal sourcing, platform adaptation, visual-readiness gate, and coding-agent QA workflow.
- [ ] Run `npx playwright test tests/ui-design.spec.ts tests/asset-plan.spec.ts tests/task-generation.spec.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run the application and generate representative web, mobile, and desktop packages in demo mode.
- [ ] Inspect exported Markdown, task order, screen/asset references, source licenses, and export blocking.
- [ ] Repeat one representative flow with the configured live provider when credentials are available and critically review the generated package.
