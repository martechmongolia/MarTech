# MarTech Squad Operating Model

This file translates the generic multi-agent framework into the actual squad model MarTech should use.

## Purpose

MarTech should not rely on one overloaded generalist agent for every task. Instead, work should be coordinated through a small set of specialist roles that can be activated based on the type of change.

This operating model is designed for:
- ongoing feature development
- hardening and reliability work
- UI and onboarding improvements
- AI/report quality improvements
- release preparation

---

## The default MarTech squad

### 1. `martech-coordinator`
**Role:** overall control tower

Owns:
- request intake
- scope decomposition
- routing work to the right specialists
- consolidating findings
- asking the human for approval at the right moments

Use this role for:
- every multi-step task
- every feature larger than a tiny copy fix
- any work involving multiple layers

---

### 2. `martech-pm`
**Role:** product scoping and acceptance criteria

Owns:
- clarifying what problem is being solved
- defining success criteria
- identifying in-scope vs out-of-scope
- framing user experience and business tradeoffs

Use this role for:
- feature design
- onboarding changes
- pricing / plan behavior changes
- roadmap shaping

---

### 3. `martech-frontend`
**Role:** user-facing UI and UX implementation

Owns:
- Next.js page and component work
- layout, spacing, hierarchy, responsiveness
- CTA clarity
- form interaction clarity
- UI polish

Use this role for:
- landing page changes
- dashboard UI improvements
- onboarding pages
- pricing / billing screens
- admin UX polish

---

### 4. `martech-backend`
**Role:** app behavior and server-side workflows

Owns:
- route handlers
- server actions
- background job flow
- orchestration logic
- auth-adjacent behavior
- business rules in code

Use this role for:
- sync flow changes
- billing workflow changes
- onboarding flow behavior
- internal ops workflow changes

---

### 5. `martech-db`
**Role:** Supabase schema, policies, migrations

Owns:
- migrations
- schema changes
- RLS / safety review
- data integrity review
- query / storage assumptions

Use this role for:
- any schema change
- usage counter changes
- report structure changes involving persistence
- billing data model changes

---

### 6. `martech-ai`
**Role:** AI analysis quality and safety

Owns:
- prompt improvements
- deterministic signal design
- AI output schemas
- validation rules
- AI behavior evaluation

Use this role for:
- report quality improvements
- prompt tuning
- signal layer improvements
- explainability / traceability improvements

---

### 7. `martech-qa`
**Role:** validation and regression control

Owns:
- test planning
- manual QA checklists
- edge-case review
- release confidence framing
- identifying where changes are under-validated

Use this role for:
- all features larger than trivial copy edits
- all risky production-facing changes
- all billing/auth/AI/sync changes

---

### 8. `martech-docs`
**Role:** documentation and release support

Owns:
- README alignment
- operator docs
- release notes
- rollout / setup notes
- internal process docs

Use this role for:
- new behaviors
- setup changes
- launch preparation
- internal ops changes

---

## Default squad combinations

### A. UI / marketing / onboarding work
Use:
- `martech-coordinator`
- `martech-pm`
- `martech-frontend`
- `martech-qa`

### B. App behavior / workflow work
Use:
- `martech-coordinator`
- `martech-pm`
- `martech-backend`
- `martech-qa`

### C. Database-affecting work
Use:
- `martech-coordinator`
- `martech-backend`
- `martech-db`
- `martech-qa`

### D. AI/reporting work
Use:
- `martech-coordinator`
- `martech-ai`
- `martech-backend`
- `martech-qa`

### E. Release work
Use:
- `martech-coordinator`
- `martech-qa`
- `martech-docs`
- plus the specialist who owns the touched area

---

## Human approval rules

Human approval should be requested before:
- destructive changes
- non-trivial schema changes
- billing behavior changes
- auth/access behavior changes
- production release steps
- user-visible product behavior changes where multiple valid options exist

Human approval is usually **not** required for:
- scoped copy fixes
- small UI polish
- internal docs updates
- low-risk refactors with no behavior change

---

## Default delivery format to the human

Every non-trivial task should end with:
- what changed
- which squad roles were involved
- files changed
- validation performed
- remaining risks / follow-ups

---

## First recommendation for MarTech

For the next stage of the product, default to these working patterns:

1. **Homepage / onboarding / pricing clarity**
   - PM + Frontend + QA
2. **Meta sync / jobs / billing hardening**
   - Backend + DB + QA
3. **AI report quality improvements**
   - AI + Backend + QA
4. **Launch preparation**
   - QA + Docs + relevant implementation role

Do not create more roles yet. Start with these eight and make them habitual.
