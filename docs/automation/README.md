# MarTech Multi-Agent Automation

This folder defines how MarTech development should be coordinated with multiple AI agents.

## Goal

MarTech has moved beyond raw MVP scaffolding. The next phase is disciplined product development:
- add features faster
- keep quality high
- reduce regressions
- keep decisions traceable
- let the human owner give direction without micromanaging every implementation detail

The automation model in this folder is designed for **human-directed, agent-assisted execution**.

## Principles

1. **The human sets direction.**
   - Product priorities, tradeoffs, and approvals come from the project owner.
2. **A coordinator agent manages execution.**
   - It breaks work down, routes tasks, merges findings, and requests approval when needed.
3. **Specialist agents own different concerns.**
   - Frontend, backend, database, AI, QA, docs, and product planning should not be blended into one vague worker.
4. **No blind autonomy.**
   - Risky changes, database changes, release steps, and external-facing behavior should always pass through review.
5. **Every feature ends with verification.**
   - A feature is not done when code exists; it is done when acceptance criteria, tests, and release notes are clear.

## Recommended core agents

- **Coordinator** — orchestrates work and final synthesis
- **Product / PM** — scope, acceptance criteria, edge cases
- **Frontend** — UI, UX, interaction, responsiveness
- **Backend** — app logic, routes, jobs, orchestration
- **Database / Supabase** — schema, migrations, RLS, data integrity
- **AI / Prompt** — AI analysis, schema discipline, prompt quality
- **QA / Reliability** — test plan, regressions, failure modes
- **Docs / Release** — README, operator docs, release notes, rollout checklist

## How to use this folder

1. Start with `AGENT_ROLES.md`
2. Read `WORKFLOW.md`
3. Use `TASK_TEMPLATE.md` for new work
4. Use `HANDOFFS.md` when passing tasks between agents
5. Use `PLAYBOOKS.md` for standard operating patterns
6. Use `MARTECH_SQUAD.md` for the actual MarTech role map
7. Use `OPENCLAW_USAGE.md` for practical usage in OpenClaw
8. Use `FIRST_WORKFLOWS.md` to classify the first real tasks
9. Use `NEXT_STEPS.md` to decide what to operationalize next

## Initial operating mode

Use this system in **human-directed mode** first:
- human provides goal
- coordinator creates a task brief
- relevant agents analyze and/or implement
- QA reviews
- human approves push/release

After the team becomes comfortable, parts of this can be automated further via OpenClaw sessions, subagents, and scheduled reviews.
