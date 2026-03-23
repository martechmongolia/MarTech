# OpenClaw Usage Guide for MarTech Squad Mode

This guide explains how the MarTech multi-agent operating model should be used in practice with OpenClaw.

## Goal

Use OpenClaw as the execution environment for coordinated development work without turning the process into chaos.

## Core idea

- The human talks to the main assistant session.
- The main assistant acts as `martech-coordinator`.
- Specialist work is delegated to subagents / isolated sessions when needed.
- The coordinator summarizes and drives the final implementation path.

---

## Recommended operating pattern

### Step 1 — Human gives a goal
Examples:
- Improve onboarding clarity
- Add report history filters
- Harden billing webhook handling
- Improve AI recommendations

### Step 2 — Coordinator creates a task brief
The coordinator should translate the request into a structured task brief based on `TASK_TEMPLATE.md`.

### Step 3 — Coordinator selects a squad
Examples:
- onboarding → PM + Frontend + QA
- billing hardening → Backend + DB + QA
- AI work → AI + Backend + QA

### Step 4 — Specialists inspect, then implement or propose
The specialists should:
- inspect relevant code
- identify risks
- suggest the cleanest path
- implement if the request is sufficiently clear

### Step 5 — QA pass
Before completion, QA should produce:
- happy path checks
- regression concerns
- release confidence summary

### Step 6 — Coordinator summarizes for the human
The coordinator should respond with:
- what changed
- why it changed
- what was checked
- any remaining risks

---

## When to spawn specialist sessions

Spawn specialist sessions when:
- the task touches multiple subsystems
- the work is complex enough to benefit from parallel review
- a second opinion is useful before implementation
- you want a role-separated analysis trail

Do **not** spawn extra sessions for every tiny edit.

---

## Suggested session labels

If persistent sessions are used, prefer these labels:
- `martech-pm`
- `martech-frontend`
- `martech-backend`
- `martech-db`
- `martech-ai`
- `martech-qa`
- `martech-docs`

The main session remains the coordinator unless a future dedicated coordinator session is created.

---

## Practical examples

### Example 1 — New onboarding feature
Squad:
- coordinator
- pm
- frontend
- qa

Flow:
1. PM defines scope and success criteria
2. Frontend implements
3. QA checks redirect behavior, mobile layout, copy clarity
4. Coordinator reports back

### Example 2 — Sync reliability improvement
Squad:
- coordinator
- backend
- db
- qa

Flow:
1. Backend maps current failure points
2. DB confirms schema/policy impact
3. Backend implements
4. QA validates retry/failure behavior
5. Coordinator summarizes residual risk

### Example 3 — AI report quality improvement
Squad:
- coordinator
- ai
- backend
- qa

Flow:
1. AI role audits prompt/schema quality
2. Backend checks implementation integration
3. changes are made
4. QA validates fallback and regression risk
5. Coordinator reports confidence and next steps

---

## Boundaries

Do not let multi-agent mode become:
- endless discussion
- role confusion
- fake progress without implementation
- uncontrolled session sprawl

The purpose is faster, higher-quality delivery — not ceremony.

---

## Recommended adoption path

### Phase 1
Use docs + manual coordination only.

### Phase 2
Use subagents for medium/large tasks.

### Phase 3
Introduce recurring automation for:
- release checklists
- docs drift review
- unresolved TODO review
- periodic quality sweeps

MarTech is currently in **Phase 1 moving into Phase 2**.
