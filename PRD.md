# AgentSpec — Product Requirements Document (MVP)

## 1. Product Overview

**Working title:** AgentSpec

AgentSpec is a local-first web application that turns a software idea into a structured specification package that can be given directly to an AI coding agent.

The product does more than generate a generic PRD. It creates a consistent set of documents that help a coding agent understand:

- what product must be built,
- who will use it,
- which features are in scope,
- important user flows and business rules,
- technical architecture and constraints,
- data model and API expectations,
- implementation order and dependencies,
- global instructions the coding agent must follow.

The MVP is focused only on the specification-generation workflow. It has no authentication, subscription, billing, team collaboration, cloud workspace, or embedded coding agent.

---

## 2. Problem Statement

AI coding agents are increasingly capable of building software, but implementation quality still depends heavily on the context given to them.

A prompt such as:

> Build a residential community marketplace app.

leaves too many important decisions undefined. As a result, coding agents commonly:

- make assumptions that were never requested,
- expand product scope,
- miss screens and UI states,
- create frontend and backend without a stable contract,
- choose architecture inconsistently,
- generate tasks that are too large,
- execute tasks in an unclear order,
- implement functionality that is outside the intended MVP.

Developers can manually ask an LLM to generate a PRD, architecture, database design, API spec, tasks, and AGENTS.md, but this requires repeated prompting and often produces inconsistent documents.

AgentSpec provides one structured workflow for producing a consistent, coding-agent-ready specification package.

---

## 3. Product Goal

The primary goal is:

> Turn a software idea into a specification package that an AI coding agent can execute with minimal requirement ambiguity.

Core transformation:

```text
Idea
  ↓
Clarification
  ↓
Project Definition
  ↓
PRD
  ↓
Feature Specifications
  ↓
Technical Specifications
  ↓
Implementation Tasks
  ↓
Agent Instructions
  ↓
Export Package
```

---

## 4. MVP Success Definition

The MVP is successful when a user can:

1. Describe a software idea in natural language.
2. Receive relevant clarification questions generated from that idea.
3. Answer those questions without needing formal product-management knowledge.
4. Review the system's understanding before generation.
5. Generate a consistent PRD.
6. Generate detailed specifications for each core feature.
7. Generate user flows and technical specifications.
8. Generate small, executable implementation tasks with dependencies.
9. Receive a **frontend-first implementation plan by default**.
10. Override the default only when the user explicitly requests module-first / vertical-slice implementation.
11. Modify specifications through natural-language instructions.
12. Export the complete specification as Markdown files for a coding agent.
13. Reload local projects after refreshing the browser.

A practical success test is:

> Would the developer prefer using AgentSpec instead of manually asking a general-purpose LLM to create and reconcile all project specifications?

And after export:

> Can a coding agent begin implementation with materially fewer questions and assumptions?

---

## 5. Target User

Primary MVP users:

- software engineers,
- full-stack developers,
- indie developers,
- AI-assisted developers,
- technical product builders,
- developers using Codex, Claude Code, Cursor, OpenCode, or similar coding agents.

The user does not need to be a product manager.

The user should be able to start with a description such as:

> I want to build a residential community app with IPL payments, marketplace, announcements, complaints, and a panic button.

AgentSpec turns that description into structured specifications.

---

## 6. Core User Flow

```text
Open Application
      ↓
Describe Product Idea
      ↓
Analyze Idea
      ↓
Generate Clarification Questions
      ↓
User Answers
      ↓
Build Project Definition
      ↓
Review Project Understanding
      ↓
Generate Specification
      ↓
Specification Workspace
      ↓
Review / Modify with AI
      ↓
Generate Implementation Tasks
      ↓
Export Specification Package
```

There is no account creation or login in the MVP flow.

---

## 7. New Project

The application opens directly to product creation.

The main input asks:

> **What do you want to build?**

The user can provide free-form input in Indonesian, English, or a mixture of both.

Accepted styles include:

- short descriptions,
- long paragraphs,
- bullet lists,
- product ideas with technical preferences,
- product ideas without technical preferences.

Primary action:

> **Start Planning**

The page may also show locally stored recent projects.

---

## 8. Idea Analysis

After the user submits an idea, the system analyzes it before generating final documents.

The analysis should identify, when available:

- product type,
- product purpose,
- target platform,
- target users,
- user roles,
- core features,
- important business rules,
- integrations,
- technical preferences,
- explicit constraints,
- explicit exclusions,
- meaningful ambiguities.

The result becomes the basis for dynamic clarification.

The system must not immediately generate the final PRD when important product decisions remain ambiguous.

---

## 9. Dynamic Clarification

Clarification is a core feature of the MVP.

Questions must be generated dynamically from the project idea rather than using one static questionnaire for every project.

Questions should focus on decisions that materially affect product behavior or implementation.

Possible clarification categories:

- users,
- roles and permissions,
- business flow,
- feature behavior,
- platform,
- external integrations,
- payment flow,
- data requirements,
- technical constraints.

Example:

```text
How should IPL payments work?

○ Online payment gateway
○ Manual admin recording
○ Both online and manual
○ Not decided yet
```

Users should be able to choose predefined options or provide a custom answer when needed.

The clarification process should reduce **meaningful ambiguity**, not create a long interview for implementation details the system can safely recommend later.

---

## 10. Project Definition

After clarification, the application creates a structured **Project Definition**.

The Project Definition is the primary source of truth for the project.

Conceptual shape:

```json
{
  "name": "Residential Community App",
  "summary": "...",
  "platform": ["web"],
  "users": [],
  "roles": [],
  "features": [],
  "requirements": [],
  "constraints": [],
  "nonGoals": [],
  "technicalPreferences": {},
  "implementation": {
    "strategy": "frontend-first"
  }
}
```

Generated Markdown documents are representations of this structured project state, not independent sources of truth.

This rule exists to reduce contradictions between PRD, feature specs, architecture, API, tasks, and agent instructions.

---

## 11. Project Review

Before large-scale generation, the user sees a review screen containing the system's current understanding.

Minimum content:

- Product Name
- Product Summary
- Users / Roles
- Platform
- Core Features
- Explicit Non-Goals / Not Included
- Implementation Strategy
- Initial Tech Stack decisions or recommendations
- Specification package that will be generated

The user can correct the project definition before selecting:

> **Generate Specification**

This step prevents incorrect assumptions from propagating through every generated document.

---

## 12. Specification Workspace

After generation, the user enters the main workspace.

Recommended navigation:

```text
Overview

Product
├── PRD
├── Features
├── User Flows
├── UI Design
└── Asset Plan

Technical
├── Architecture
├── Data Model
└── API

Implementation
├── Tasks
└── Agent Instructions
```

The workspace should feel like a specification/documentation environment rather than a project-management tool.

Primary information should emphasize:

- requirements,
- decisions,
- constraints,
- references,
- dependencies,
- acceptance criteria,
- agent context.

The MVP should avoid unnecessary project-management concepts such as schedules, assignees, comments, sprint planning, or task priority dashboards.

---

## 13. Product Overview

The Overview provides a concise project summary.

Minimum fields:

- Product Name
- Product Summary
- Platform
- Users
- Core Features
- Technical Stack
- Implementation Strategy
- Scope Constraints

It should be possible to understand the project's main intent from this screen without reading the full PRD.

---

## 14. PRD Generator

The PRD focuses on product requirements rather than detailed implementation instructions.

Minimum structure:

```text
Product Overview
Problem Statement
Product Goals
Target Users
User Roles
Core Features
Functional Requirements
User Flows
Business Rules
Edge Cases
Non-Functional Requirements
Non-Goals
MVP Scope
```

### Non-Goals

When exclusions are known, they should be explicit.

Example:

```text
Non-Goals

- Visitor management
- Package tracking
- Vehicle registration
- Smart-home integration
```

Non-Goals are important because they tell a coding agent what it must **not** implement.

---

## 15. Feature Specifications

Each core feature receives its own detailed specification.

Minimum feature structure:

```text
Feature Name
Purpose
Actors
Main Flow
Requirements
Business Rules
Edge Cases
Acceptance Criteria
```

Every significant requirement should have a stable identifier.

Examples:

```text
AUTH-001
MARKET-003
PANIC-004
```

Example feature:

```text
Panic Button

Purpose
Allow residents to request emergency assistance quickly.

Actors
- Resident
- Administrator / Security

Main Flow
Resident
→ Open Panic Button
→ Intentional confirmation
→ Create panic event
→ Notify responsible party
→ Show result

Requirements
PANIC-001 Resident can activate a panic request.
PANIC-002 Activation requires intentional confirmation.
PANIC-003 System records resident and trigger time.

Business Rules
...

Edge Cases
...

Acceptance Criteria
...
```

Requirement identifiers are later referenced by implementation tasks.

---

## 16. User Flows

The application generates simple flows for important interactions.

Example:

```text
Create Complaint

Resident
↓
Open Complaints
↓
Create Complaint
↓
Choose Category
↓
Enter Description
↓
Submit
↓
Complaint Created
↓
Admin Receives Complaint
```

Simple readable flows are preferred over complex diagram tooling in the MVP.

Flows must remain consistent with feature specifications and the Project Definition.

---

## 17. Technical Architecture

AgentSpec generates an architecture recommendation using known requirements and explicit user preferences.

The architecture specification should cover when relevant:

- frontend,
- backend,
- database,
- authentication approach,
- storage,
- realtime communication,
- external services,
- system boundaries,
- high-level data flow.

### Technical Decision Source

The UI and internal model should distinguish between:

- **User Selected** — explicitly chosen by the user.
- **Recommended** — selected by AgentSpec as a recommendation.
- **Undecided** — not yet decided.

Example:

| Component | Technology | Source |
| --- | --- | --- |
| Frontend | Next.js | User Selected |
| Backend | Laravel | User Selected |
| Database | PostgreSQL | Recommended |
| Realtime | WebSocket | Recommended |
| Payment | Not selected | Undecided |

AgentSpec must not silently replace explicit user technology choices.

It also must not present an AI recommendation as though the user had already decided it.

---

## 17.1 Visual Specification Contract

Two generated documents make the visual result implementable instead of interpretable.

### UI Design (`docs/ui-design.md`)

The UI design specification is the only source of visual truth. It contains:

- a product-specific creative concept and its rationale,
- two or three signature moments tied to concrete screens,
- font families with a legal source and a system fallback,
- semantic color, spacing, radius, elevation, and motion tokens,
- layout, shell, navigation, grid, and breakpoints,
- one platform profile per target platform covering navigation, units, input modes, safe areas, resizing, and adaptive behavior,
- approved UI dependencies (icon family, chart library, animation, map, component primitives) with their decision source and valid platforms,
- a component inventory with anatomy, variants, states, token references, and platform notes,
- every screen with its layout regions, components, states, realistic sample content, asset references, and acceptance criteria,
- interaction, accessibility, content, anti-pattern, and visual-QA rules.

The generator must not add authentication, dashboards, tables, or list/detail surfaces the requirements do not need. When the user provides little visual guidance, the system infers one product-specific direction and records the reasoning rather than falling back to a universal dashboard preset.

### Asset Plan (`docs/asset-plan.md`)

The asset plan is the only source of truth for iconography and media. It contains:

- a source policy that requires free, legal, repository-local assets,
- exactly one icon system per target platform with size, stroke, fill, alignment, color, accessibility, and concrete action-to-icon mappings,
- a curated source catalog with official URL, asset types, license, attribution requirement, and platform restrictions,
- one entry per media asset with type, purpose, screen references, placement, source method, query, destination path, format, dimensions, aspect ratio, treatment, alt text, fallback, platform variants, license, and attribution.

The coding agent downloads or creates each asset at its documented local path and implements its fallback. Assets from unverified sources block the visual-readiness check.

### Cross-Document Rules

- Feature specifications declare whether a feature is user-facing, its UI surfaces, and its media requirements.
- Frontend and integration tasks reference concrete screen ids and asset ids.
- `AGENTS.md` requires both visual documents to be read before interface code is written, and requires a screenshot-based visual QA pass.
- Editing visual intent marks UI Design, Asset Plan, Tasks, and Agent Instructions stale.
- The Markdown ZIP export stays disabled while a visual artifact is missing or a high-severity consistency issue is open; the project JSON export remains available.

---

## 18. Data Model

The generated data model must contain enough detail for a coding agent to begin implementation planning.

Each entity should contain:

- entity name,
- fields,
- field purpose when not obvious,
- important constraints,
- relationships.

Example:

```text
panic_events

id
resident_id
status
triggered_at
resolved_at
resolved_by
created_at
updated_at
```

Relationship example:

```text
User
 ├── 1:N Complaint
 ├── 1:N MarketplaceListing
 └── 1:N PanicEvent
```

Migration code is not required from AgentSpec in the MVP.

---

## 19. API Specification

When the chosen architecture uses an API, the system generates API specifications.

Minimum endpoint specification:

- HTTP method,
- route,
- purpose,
- actor,
- authentication requirement,
- request shape,
- response shape,
- important error cases.

Example:

```text
POST /api/panic

Purpose
Create a panic event.

Actor
Resident

Authentication
Required

Request
...

Response
...

Errors
401 Unauthorized
409 Panic already active
```

Generating a full OpenAPI document is not required for the MVP.

---

## 20. Implementation Strategy

The MVP understands two implementation strategies:

```text
frontend-first
module-first
```

### Default behavior

If the user does not explicitly request a different implementation approach:

```text
implementation.strategy = frontend-first
```

The application should not require the user to answer an implementation-strategy question by default.

---

## 21. Frontend-First Rule

The default task plan follows this conceptual order:

```text
Project Foundation
↓
Frontend Foundation
↓
Frontend Features
↓
Frontend Completion
↓
Backend Foundation
↓
Backend Features
↓
Frontend–Backend Integration
↓
Testing and Validation
```

The goal is to complete and review the product experience before significant backend implementation.

During frontend work, the coding agent should use mock data/services when a backend is unavailable.

Mock data must not be tightly coupled directly into UI components.

Preferred abstraction:

```text
UI
↓
Service / Repository Interface
↓
Mock Implementation
```

Later replaced by:

```text
UI
↓
Service / Repository Interface
↓
API Implementation
```

---

## 22. Frontend Task Requirements

Frontend tasks must describe the complete UI experience rather than only asking for a page to be created.

Example:

```text
TASK-014
Build Product List

Requirements
- display products
- search
- filtering
- pagination
- responsive layout

UI States
- loading
- populated
- empty
- error

Data
- use ProductService interface
- use mock implementation during frontend phase

Acceptance Criteria
- all required states are implemented
- page works on mobile and desktop
- filters update displayed products
- mock data is not tightly coupled to UI components
```

Frontend tasks should cover important states such as:

- default / populated,
- loading,
- empty,
- validation,
- success,
- error,
- responsive behavior when relevant.

---

## 23. Explicit Module-First Override

The task planner changes to `module-first` only when the user's intent explicitly indicates an end-to-end / vertical-slice approach.

Examples of explicit intent:

- "Kerjakan per module."
- "Auth frontend dan backend selesai dulu baru lanjut."
- "Use vertical slices."
- "Selesaikan setiap feature end-to-end."

Then tasks are organized conceptually as:

```text
Foundation

Authentication
├── Frontend
├── Database
├── Backend
├── Integration
└── Validation

Products
├── Frontend
├── Database
├── Backend
├── Integration
└── Validation
```

Without explicit override, frontend-first remains the default.

---

## 24. Implementation Task Generator

Implementation tasks are one of the primary outputs of AgentSpec.

Each task must include:

- unique task ID,
- title,
- implementation type,
- related feature,
- dependencies,
- relevant requirement references,
- context documents,
- requirements,
- acceptance criteria.

Example:

```text
TASK-021
Build Panic Button Screen

Type
Frontend

Feature
Panic Button

Dependencies
TASK-008

References
PANIC-001
PANIC-002
PANIC-003

Context
- docs/PRD.md
- docs/features/panic-button.md
- docs/architecture.md

Requirements
- build emergency action UI
- intentional confirmation
- loading state
- success state
- error state
- use panic service abstraction
- use mock panic service during frontend phase

Acceptance Criteria
- accidental activation is prevented
- required UI states exist
- implementation works without backend availability
```

Tasks should be small enough that a coding agent can execute them one by one.

---

## 25. Task Dependencies

Tasks can depend on earlier tasks.

Conceptual structured representation:

```json
{
  "id": "TASK-016",
  "blockedBy": ["TASK-008"]
}
```

The generated task order must respect these dependencies.

A visual dependency graph is not required in the MVP.

---

## 26. Agent Instructions Generator

AgentSpec generates a generic `AGENTS.md` for the coding agent.

Minimum content:

```text
Project Overview
Source of Truth
Technology Stack
Architecture Rules
Implementation Strategy
Scope Rules
Coding Guidelines
Testing Expectations
Task Execution Workflow
```

For the default strategy, the generated instructions must include rules equivalent to:

```text
This project follows a frontend-first implementation strategy.

Unless explicitly stated otherwise:

1. Complete the frontend experience before backend implementation.
2. Build all required screens and user flows.
3. Implement loading, empty, error and populated states.
4. Use mock services when backend functionality is unavailable.
5. Keep mock implementations behind service interfaces.
6. Do not implement backend functionality during frontend-only tasks.
7. Do not expand the product scope beyond the specification.
```

---

## 27. Edit With AI

The workspace provides a natural-language modification input.

Example instructions:

> Marketplace tidak perlu checkout. Hanya listing dan contact penjual.

> Change the backend from NestJS to Laravel.

> Add Google login.

For a requested change, the system should:

1. understand the change,
2. update the structured Project Definition,
3. determine which specifications are affected,
4. regenerate only the affected information where practical,
5. keep related documents consistent.

The MVP should not become a general-purpose chatbot.

The AI input exists specifically to modify or clarify the specification.

---

## 28. Consistency Requirement

All generated artifacts derive from the same Project Definition.

Example:

If the project states that the marketplace has no checkout:

- PRD must not require checkout,
- feature spec must not include cart/checkout,
- API spec must not define checkout endpoints,
- data model must not create order entities unless otherwise required,
- tasks must not request checkout implementation,
- agent instructions must not introduce checkout.

Before the output is considered ready, the generation workflow should perform a consistency validation pass.

An AI-based consistency validator is sufficient for the MVP; a complex deterministic rule engine is not required.

---

## 29. Export

The primary coding-agent export is a **Markdown Package** downloaded as ZIP.

Expected structure:

```text
project-spec/
│
├── README.md
├── AGENTS.md
│
├── docs/
│   ├── product-brief.md
│   ├── PRD.md
│   ├── user-flows.md
│   ├── ui-design.md
│   ├── asset-plan.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── api.md
│   │
│   └── features/
│       ├── authentication.md
│       ├── marketplace.md
│       ├── complaints.md
│       └── panic-button.md
│
└── tasks/
    ├── README.md
    ├── TASK-001.md
    ├── TASK-002.md
    └── ...
```

The exported Markdown must be plain and portable. It must not require proprietary AgentSpec syntax to be understood by a coding agent.

Agent-specific exports for individual coding tools are out of scope for this MVP.

---

## 30. Starter Prompt

The application also generates a copyable generic starter prompt for the coding agent.

Example:

```text
Read AGENTS.md and the relevant project documentation under /docs.

Treat the provided specifications as the source of truth.

Before implementing anything:

1. Inspect the current repository.
2. Understand the documented architecture.
3. Review task dependencies.
4. Identify the first unblocked task.

Then execute tasks one at a time.

Do not implement features outside the documented scope.

For frontend-phase tasks, do not implement backend functionality unless the task explicitly requires it.
```

---

## 31. Local Project Persistence

The MVP does not require user accounts or cloud storage.

Projects are stored locally in the browser using **IndexedDB**.

Minimum persistent state:

- Project Definition
- Original Idea
- Clarification Questions and Answers
- Generated Documents
- Feature Specifications
- Tasks
- AI Modification History / relevant context
- Local application settings required by the project

Refreshing the browser must not remove saved projects.

---

## 32. Local Project Management

The local-only MVP supports:

- New Project
- Open Local Project
- Delete Local Project
- Export Project
- Import Project

Internal project import/export may use JSON so a user can continue editing in AgentSpec.

This JSON export is separate from the Markdown package intended for coding agents.

---

## 33. AI Generation Architecture

The product should not depend on one giant prompt that asks an LLM to generate everything in one response.

Logical pipeline:

```text
User Idea
    ↓
Project Analyzer
    ↓
Clarification Generator
    ↓
Project Definition Builder
    ↓
PRD Generator
    ↓
Feature Specification Generator
    ↓
Technical Specification Generator
    ↓
Task Planner
    ↓
Agent Instructions Generator
    ↓
Consistency Validator
```

These are logical responsibilities and may use the same underlying AI model.

They do not need to be implemented as independent autonomous agents.

---

## 34. Structured AI Output

Application state produced by AI should use structured JSON and schema validation.

Markdown is primarily a document presentation and export format.

Example internal task shape:

```json
{
  "id": "TASK-021",
  "title": "Build Panic Button Screen",
  "type": "frontend",
  "featureId": "panic-button",
  "dependencies": ["TASK-008"],
  "requirements": [],
  "acceptanceCriteria": [],
  "references": ["PANIC-001", "PANIC-002"]
}
```

Structured state is needed for:

- task ordering,
- task dependencies,
- filtering,
- partial regeneration,
- editing,
- reference tracking,
- consistent Markdown generation.

AI output that becomes application state must be validated before it is saved.

---

## 35. Functional Requirements

### FR-001 — Create Project
User can create a project from a free-form software idea.

### FR-002 — Analyze Idea
System identifies important product concepts and ambiguities.

### FR-003 — Dynamic Clarification
System generates project-specific clarification questions.

### FR-004 — Answer Clarification
User can answer through options or custom input.

### FR-005 — Project Definition
System creates a structured source-of-truth Project Definition.

### FR-006 — Project Review
User can review and correct project understanding before full generation.

### FR-007 — Generate PRD
System generates a PRD based on the Project Definition.

### FR-008 — Generate Feature Specifications
System generates detailed specifications for core features.

### FR-009 — Generate User Flows
System generates flows for important user interactions.

### FR-010 — Generate Architecture
System generates architecture based on requirements and user preferences.

### FR-011 — Generate Data Model
System generates required entities, fields, constraints, and relationships.

### FR-012 — Generate API Specification
System generates API requirements when the architecture requires an API.

### FR-013 — Generate Tasks
System creates executable implementation tasks.

### FR-014 — Frontend-First Default
System uses frontend-first task ordering unless explicitly overridden.

### FR-015 — Module-First Detection
System uses module-first only when explicit user intent is detected.

### FR-016 — Task Dependencies
System creates dependencies between tasks.

### FR-017 — Agent Instructions
System generates `AGENTS.md`.

### FR-018 — Modify With AI
User can modify the project specification with natural-language instructions.

### FR-019 — Maintain Consistency
System keeps related specifications aligned after changes.

### FR-020 — Local Persistence
Projects remain available locally after browser refresh.

### FR-021 — Export Markdown Package
User can download the complete specification as a ZIP of Markdown files.

### FR-022 — Starter Prompt
System provides a coding-agent starter prompt.

### FR-023 — Import Project
User can restore an AgentSpec project from its local JSON export.

---

## 36. Non-Functional Requirements

### NFR-001 — Primary Device
The authoring experience must work well on desktop and tablet. Mobile may be responsive but is not the primary authoring target.

### NFR-002 — Generation Feedback
Generation progress must be visible to the user.

### NFR-003 — Failure Isolation
If one generation step fails, already completed specification data must not be discarded.

### NFR-004 — Structured Validation
AI output that enters application state must be validated against a schema.

### NFR-005 — Local Operation
The project workspace must not require an application database server solely to persist local projects.

### NFR-006 — Portable Export
Exported Markdown documents must be readable independently of AgentSpec.

### NFR-007 — Tool Neutrality
The generic exported specification must not depend on one particular coding agent.

### NFR-008 — Source-of-Truth Consistency
Explicit user decisions must remain consistent across generated outputs.

---

## 37. MVP UI Surfaces

The MVP needs the following core UI states:

1. **New Project** — idea input and local recent projects.
2. **Clarification** — dynamic questions plus current detected context.
3. **Project Review** — confirmation of product definition before generation.
4. **PRD Workspace** — generated PRD and specification editing.
5. **Feature Specification** — detailed requirements for each feature.
6. **UI Design** — visual direction, design tokens, component inventory, and every screen with its layout and states.
7. **Asset Plan** — icon systems per platform, media placements, legal sources, licenses, local paths, and fallbacks.
8. **Technical Architecture** — architecture, tech decisions, and system context.
9. **Data Model** — entity and relationship specification.
10. **API** — endpoint specification where relevant.
11. **Implementation Tasks** — frontend-first task structure by default.
12. **Agent Instructions** — generated AGENTS.md.
13. **Export Specification** — Markdown ZIP, local Project JSON, starter prompt.

These surfaces may live inside two primary application contexts:

```text
New Project Flow
Project Workspace
```

A separate marketing site is not required for the MVP.

---

## 38. UI Product Principles

The UI should visually behave like a **specification builder for coding agents**, not like a project-management application.

Prioritize:

- requirements,
- product decisions,
- source of each technical decision,
- constraints,
- references,
- dependencies,
- acceptance criteria,
- agent-ready context.

Avoid introducing MVP concepts such as:

- schedules,
- task assignees,
- sprint management,
- comments,
- task priority dashboards,
- progress analytics,
- requirement-coverage dashboards,
- team activity feeds.

The supplied UI screenshots define the desired visual direction, but where a screenshot shows any project-management concept that conflicts with this PRD, **this PRD takes precedence**.

---

## 39. Out of Scope

The following are explicitly outside the MVP:

- user accounts,
- login,
- authentication for AgentSpec itself,
- subscription,
- billing,
- credits / token accounting,
- pricing,
- teams,
- organizations,
- collaboration,
- role-based workspace permissions,
- public project sharing,
- cloud project storage,
- GitHub integration,
- GitLab integration,
- repository synchronization,
- embedded code generation environment,
- embedded coding agent,
- IDE functionality,
- automatic execution of generated tasks,
- deployment,
- hosting,
- admin dashboard,
- analytics dashboard,
- public template marketplace,
- community features,
- agent-specific export formats,
- project-management features such as scheduling, assignment, sprinting, and comments.

AgentSpec MVP ends at:

> **Create, manage, refine, and export a coding-agent-ready software specification.**

---

## 40. Core Product Principle

> **The specification is the product.**

AgentSpec is not an IDE.

AgentSpec is not a coding agent.

AgentSpec is not a general-purpose chatbot.

AgentSpec is not a project-management system.

It is the structured layer between a developer's product intent and the AI coding agent that will implement it.

Default implementation philosophy:

> **Frontend first, unless the user explicitly requests module-first development.**
