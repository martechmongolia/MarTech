# First Operational Workflows

This file defines the first three practical workflows MarTech should use with the multi-agent system.

## Workflow 1 — UI / onboarding improvement

### Use for
- homepage clarity
- onboarding improvement
- pricing clarity
- dashboard polish

### Squad
- coordinator
- pm
- frontend
- qa

### Sequence
1. PM clarifies the problem and success criteria.
2. Frontend inspects current pages/components.
3. Frontend implements the smallest clean solution.
4. QA checks:
   - responsive layout
   - CTA clarity
   - empty/error states if relevant
   - regressions in existing redirects/flows
5. Coordinator summarizes outcome and remaining polish ideas.

### Expected deliverables
- changed UI files
- concise rationale
- QA checklist/result

---

## Workflow 2 — Reliability / backend hardening

### Use for
- billing hardening
- sync retries
- auth flow correctness
- internal ops safety

### Squad
- coordinator
- backend
- db (if data/state changes)
- qa

### Sequence
1. Backend maps current flow and failure points.
2. DB reviews schema/policy/data implications if needed.
3. Backend proposes the cleanest minimal fix.
4. Backend implements.
5. QA checks:
   - happy path
   - failure path
   - idempotency / repeated action behavior where relevant
   - operator visibility
6. Coordinator reports confidence and open risks.

### Expected deliverables
- changed logic files
- migration notes if any
- risk summary
- validation summary

---

## Workflow 3 — AI/report quality iteration

### Use for
- prompt refinement
- signal improvements
- validation changes
- recommendation quality improvements

### Squad
- coordinator
- ai
- backend
- qa

### Sequence
1. AI role audits current behavior and identifies weak points.
2. Backend checks integration and downstream contracts.
3. AI/Backend implement prompt/schema/logic changes.
4. QA checks:
   - fallback behavior
   - schema consistency
   - regression risk
   - output quality expectations
5. Coordinator summarizes improvement level and remaining limitations.

### Expected deliverables
- changed AI files
- validation notes
- quality/risk summary

---

## Recommendation

For the next few weeks, route almost all MarTech work through one of these three workflows.

If a task does not fit clearly, the coordinator should first classify it before any implementation begins.
