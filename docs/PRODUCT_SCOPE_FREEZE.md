# Product Scope Freeze — MarTech MVP v0.1.0

**Date**: 2026-03-22
**Status**: Frozen for production hardening. No new features until hardening complete.

## Modules in scope

| Module | Status | Notes |
|---|---|---|
| Auth (email OTP, magic link) | Shipped | Supabase Auth, passwordless |
| Organization (create, single-owner) | Shipped | One org per user |
| Subscription (starter, growth plans) | Shipped | bootstrap_pending_billing → active |
| Meta OAuth (connect, page discovery) | Shipped | Graph API v21.0 |
| Meta Page Selection | Shipped | Plan-limited page count |
| Sync Pipeline (page + post metrics) | Shipped | Idempotent jobs, manual + scheduled |
| AI Analysis (LLM insights) | Shipped | OpenAI gpt-4o-mini, post-sync hook |
| QPay Billing (invoice, verify, webhook) | Shipped | QPay V2 API |
| Internal Ops Admin | Shipped | /internal/ops, audit log |
| Privacy / Terms / Data Deletion | Shipped | /privacy, /terms, /data-deletion |

## Modules NOT in scope (deferred)

- Multi-user / team member invites
- Instagram / TikTok integrations
- Cron-based scheduled sync
- Email notifications / alerts
- Dashboard charts / visualizations (beyond text)
- Custom report export (PDF/CSV)
- Multi-language i18n
- Mobile app

## Environment matrix

| Service | Provider | Plan |
|---|---|---|
| Hosting | Vercel | Free/Pro |
| Database + Auth | Supabase | Pro |
| Domain | martech.mn | Production |
| Payments | QPay V2 | NEGE_MN merchant |
| AI | OpenAI | API (gpt-4o-mini) |
| Email | Supabase built-in | Pro rate limits |

## Quality gates (must pass before release)

- `npm run typecheck` — zero errors
- `npm run lint` — zero errors
- `npm run test` — all pass
- `npm run build` — succeeds
- `.env.example` matches all env vars read by code
