# MarTech MVP v1

Phase 2–7 foundations are implemented from `MarTech-MVP-v1-Spec.md`:
- Supabase Auth login flow (email OTP)
- Organization bootstrap flow (create org + owner membership)
- Protected dashboard shell
- Initial migration for `profiles`, `organizations`, `organization_members` with RLS
- Subscription foundation for `plans`, `subscriptions`, `usage_counters`
- Meta OAuth + organization-level page connection foundation
- Meta sync job records + normalized `page_daily_metrics` / `page_post_metrics`
- AI analysis jobs + reports + recommendations (deterministic signals + optional OpenAI narrative; not a chatbot)
- QPay billing foundation: `invoices`, `payment_transactions`, `billing_events`, checkout + verified webhook path (see `docs/billing-qpay.md`)

## Run locally

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - `cp .env.example .env.local`
   - Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL`
   - Fill `SUPABASE_SERVICE_ROLE_KEY` (server-only: sync + AI persistence)
   - Optional: `OPENAI_API_KEY`, `AI_MODEL` for LLM narrative (see `docs/ai-analysis.md`)
   - Fill Meta vars: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_TOKEN_ENCRYPTION_KEY`
   - QPay (billing): `QPAY_BASE_URL`, `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE` (see `docs/billing-qpay.md`)
   - Optional: `MARTECH_INTERNAL_OPS_EMAILS` — bootstrap + legacy ops (see `docs/admin-auth-v1.md`)
3. Apply migrations in your Supabase project:
   - run SQL in `supabase/migrations/202603220001_phase2_auth_org.sql`
   - run SQL in `supabase/migrations/202603220002_phase3_subscriptions.sql`
   - run SQL in `supabase/migrations/202603220003_phase2_phase3_hardening.sql`
   - run SQL in `supabase/migrations/202603220004_phase4_meta_foundation.sql`
   - run SQL in `supabase/migrations/202603220005_phase5_meta_sync.sql`
   - run SQL in `supabase/migrations/202603220006_phase6_ai_analysis.sql`
   - run SQL in `supabase/migrations/202603220007_phase6_ai_hardening.sql`
   - run SQL in `supabase/migrations/202603220008_phase7_billing_qpay.sql`
   - run SQL in `supabase/migrations/202603220009_phase7_billing_hardening.sql`
   - run SQL in `supabase/migrations/202603220010_operator_audit.sql` (operator audit for `/internal/ops` actions)
4. Seed plans:
   - run SQL in `supabase/seeds/202603220001_plans.sql`
5. Start app:
   - `npm run dev`
6. Open:
   - `http://localhost:3000`

## Current flow

1. User goes to `/login` and requests a login link.
2. `/auth/callback` exchanges code for session.
3. If user has no organization, app redirects to `/setup-organization`.
4. Organization creation uses one transactional RPC (`create_organization_with_starter`) to atomically create:
   - organization
   - owner membership
   - starter subscription bootstrap state
5. Starter bootstrap status is `bootstrap_pending_billing` (explicit pre-billing state).
6. User is redirected to protected `/dashboard`.
7. Pricing at `/pricing` starts **QPay checkout** for paid plans; `/billing` shows invoices and events.
8. Webhook: `POST /api/webhooks/qpay?invoice_id=…&token=…` (configure `NEXT_PUBLIC_APP_URL` for callbacks).
9. Meta connection and page selection are managed at `/pages`.
10. Selecting a page enqueues and runs an `initial_sync` job (server-side); dashboard shows sync status, stored metrics, and a **manual sync** action (plan daily quota via `usage_counters.manual_syncs_used`).
11. After each **successful** sync, an **analysis** job may run (monthly `ai_reports_generated` vs plan); dashboard shows summary, signals, and recommendations.

## Multi-agent development

- Multi-agent operating docs live in `docs/automation/`
- Start with `docs/automation/README.md`
- Use `docs/automation/TASK_TEMPLATE.md` for new feature briefs
- Use `docs/automation/AGENT_ROLES.md` and `docs/automation/WORKFLOW.md` as the operating model
- Use `docs/automation/MARTECH_SQUAD.md` for the MarTech role map
- Use `docs/automation/OPENCLAW_USAGE.md` for practical OpenClaw squad usage

## Notes

- Private beta ops: `docs/private-beta-launch.md` (env checklist, webhooks, service role, internal ops). Idempotency / retry verification: `docs/operations/idempotency-checklist.md`.
- QPay billing foundation: see `docs/billing-qpay.md` (invoice → webhook → `payment/check` → subscription activation).
- Sync execution runs **inline** from server actions today (no cron/queue); the same `executeMetaSyncJob(jobId)` entrypoint is intended for a worker later.
- AI analysis uses `executeAnalysisJob(jobId)` the same way after sync; see `docs/ai-analysis.md` (deterministic signals + optional `OPENAI_API_KEY`).
- Supabase Auth is platform auth; Meta OAuth is external datasource authorization.
- Meta provider tokens are stored only in server/database and are never returned to the client.
- Page connection limits for Meta use `meta_pages` selection state (not `usage_counters`) as the source of truth.
- Keep future changes aligned with `roadmap.md`.
