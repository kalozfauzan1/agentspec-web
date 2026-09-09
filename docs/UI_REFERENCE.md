# AgentSpec MVP — UI Reference Guide

## Purpose

The images in `docs/ui/` are the approved **visual foundation** for the AgentSpec MVP.

They define the desired:

- visual language,
- layout composition,
- typography hierarchy,
- white + indigo/blue color direction,
- sidebar navigation pattern,
- central document workspace,
- right-side contextual panels where useful,
- rounded cards and subtle borders/shadows,
- bottom AI-edit input pattern,
- technical diagram treatment,
- split-panel task treatment,
- export package preview treatment.

They are **not** a higher authority than `PRD.md` for feature scope.

## Conflict Rule

When a screenshot contains functionality not supported by the PRD:

> **Follow the PRD and keep only the visual pattern.**

Examples of screenshot details that must NOT automatically become MVP features:

- comments,
- schedules,
- assignees,
- Jira-style task status management,
- task priority workflows,
- progress analytics,
- requirement-coverage percentage dashboards,
- conversation-history product features,
- AI suggestion gimmicks that expand product scope.

The MVP is a **Specification Builder for Coding Agents**, not an AI project-management tool.

---

## 01 — New Project

File: `ui/01-new-project.png`

Use as visual reference for:

- AgentSpec header/logo area,
- large central idea textarea,
- dominant `Start Planning` CTA,
- lightweight project-type examples,
- local recent-project cards,
- clean, low-friction first-use experience.

Functional source of truth: PRD sections **7, 31, 32**.

---

## 02 — Clarification

File: `ui/02-clarification.png`

Use as visual reference for:

- step-based clarification flow,
- dynamic radio / checkbox answers,
- short explanations below choices,
- progress indicator,
- right-side `Detected Project` / current context panel.

Clarification questions must be dynamically generated from project ambiguity. Do not hardcode the exact questions shown in the screenshot.

Functional source of truth: PRD sections **8–10**.

---

## 03 — Project Review

File: `ui/03-project-review.png`

Use as visual reference for:

- final confirmation before generation,
- product summary card,
- users, platform, features, non-goals,
- implementation strategy,
- tech stack summary,
- right-side list of documents to generate,
- prominent `Generate Specification` action.

Important implementation rule:

- Explicit user choices must be preserved.
- AI recommendations must be labeled as recommendations.
- Undecided technology choices must remain undecided rather than silently picking a provider.

Functional source of truth: PRD sections **10, 11, 17**.

---

## 04 — PRD Workspace

File: `ui/04-prd-workspace.png`

Use as the main workspace visual foundation:

- permanent left sidebar,
- project name in top header,
- large readable document area,
- optional right-side project context,
- bottom `Ask AI to update this specification...` input.

Recommended sidebar:

```text
Overview

Product
- PRD
- Features
- User Flows

Technical
- Architecture
- Data Model
- API

Implementation
- Tasks
- Agent Instructions
```

Do not turn the workspace into a general chat application.

Functional source of truth: PRD sections **12–14, 27**.

---

## 05 — Feature Specification

File: `ui/05-feature-specification.png`

Use as visual reference for detailed feature documentation.

Keep these sections prominent:

- Purpose
- Actors
- Main Flow
- Requirements with stable IDs
- Business Rules
- Edge Cases
- Acceptance Criteria

A lightweight related-context panel can show relevant flows/tasks/references.

Do not implement requirement-coverage analytics solely because a chart appears in the original visual reference.

Functional source of truth: PRD sections **15, 16, 24, 25**.

---

## 06 — Technical Architecture

File: `ui/06-technical-architecture.png`

Use as visual reference for:

- architecture header,
- visual system diagram,
- stack table,
- system boundaries,
- data flow,
- technical decision context.

The implementation must distinguish:

- `User Selected`
- `Recommended`
- `Undecided`

Do not silently hardcode Stripe, SendGrid, Twilio, map providers, storage providers, or other services unless they come from project requirements or are clearly marked recommendations.

Functional source of truth: PRD sections **17–19**.

---

## 07 — Implementation Tasks

File: `ui/07-implementation-tasks.png`

The overall split-panel design is approved and should be retained.

Left/main area:

- grouped task phases,
- frontend-first ordering by default,
- compact task list,
- dependencies visible where useful.

Task detail area should focus on:

- Task ID
- Title
- Type
- Feature
- Dependencies
- Requirement references
- Context documents
- Requirements
- UI states for frontend tasks
- Acceptance Criteria

Do **not** implement the screenshot's project-management-style concepts such as:

- scheduling,
- comments,
- assignees,
- sprint management,
- priority workflow,
- completion analytics.

Default conceptual ordering:

```text
Project Foundation
Frontend Foundation
Frontend Features
Frontend Completion
Backend Foundation
Backend Features
Integration
Testing and Validation
```

Only switch to module-first when explicitly requested by the project user.

Functional source of truth: PRD sections **20–25**.

---

## 08 — Export Specification

File: `ui/08-export-specification.png`

Use as visual reference for:

- simple export choices,
- package preview tree,
- starter prompt panel,
- prominent Markdown ZIP download.

MVP export options:

1. Markdown specification package (`.zip`)
2. AgentSpec project JSON for local import/restore
3. Copyable generic starter prompt

Do not implement agent-specific Codex/Claude/Cursor export formats in MVP.

Functional source of truth: PRD sections **29, 30, 32**.

---

## Visual Direction Summary

Keep the style of the original UI references:

- premium but minimal developer-tool aesthetic,
- bright workspace,
- deep navy text,
- indigo/blue primary actions,
- subtle blue-tinted selected states,
- thin neutral borders,
- low-elevation shadows,
- rounded but not overly playful cards,
- readable documentation typography,
- strong information hierarchy,
- generous desktop spacing.

The UI should feel closer to a modern technical documentation/product-planning tool than to a marketing website or task tracker.
