# Deployment Readiness Checklist

Use this before every production deployment.

## 1. Quality Gates (automated via `npm run validate`)

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run test` — all 85+ tests pass
- [ ] `npm run build` — clean production build

## 2. Environment Variables (Vercel)

Every variable below must be set in Vercel's production environment.
Compare against `.env.example` for descriptions.

### Required — app will not start without these

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://martech.mn` | Must match your domain exactly (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Secret.** Service role key for admin operations |
| `CRON_SECRET` | `<random 32+ char>` | **Secret.** Protects `/api/cron/*` and `/api/digest/*` from unauthorized invocation. Vercel Cron sends it as `x-cron-secret` header (digest route uses `authorization: Bearer`). |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | Upstash REST URL for app-level rate limiting. Auto-filled by Vercel → Storage → Upstash. |
| `UPSTASH_REDIS_REST_TOKEN` | `AXX...` | **Secret.** Upstash REST token. If either Upstash var is missing, rate limits fail open (logged + allowed). |

### Required for Meta integration

| Variable | Example | Notes |
|----------|---------|-------|
| `META_APP_ID` | `26731368393113939` | Facebook App ID |
| `META_APP_SECRET` | `66f1f6...` | **Secret.** Facebook App Secret |
| `META_REDIRECT_URI` | `https://martech.mn/api/meta/callback` | Must match Facebook App OAuth settings exactly |
| `META_API_VERSION` | `v21.0` | Graph API version |
| `META_TOKEN_ENCRYPTION_KEY` | `61b963...` | **Secret.** 64-char hex key for token encryption |

### Required for billing

| Variable | Example | Notes |
|----------|---------|-------|
| `QPAY_BASE_URL` | `https://merchant.qpay.mn` | QPay V2 base URL |
| `QPAY_CLIENT_ID` | `NEGE_MN` | QPay merchant username |
| `QPAY_CLIENT_SECRET` | `maVeJRVC` | **Secret.** QPay merchant password |
| `QPAY_INVOICE_CODE` | `NEGE_MN_INVOICE` | QPay invoice code |

### Required for AI

| Variable | Example | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` | **Secret.** OpenAI API key |
| `AI_MODEL` | `gpt-4o-mini` | Model to use for analysis |

### Required for internal ops / system admin

| Variable | Example | Notes |
|----------|---------|-------|
| `MARTECH_INTERNAL_OPS_EMAILS` | `admin@martech.mn` | Comma-separated. Bootstrap when `system_admins` is empty; also grants **legacy internal ops page access** and **env-based operator mutations** without a DB row. **`/admin`** still requires a `system_admins` row (or bootstrap) — see `docs/admin-auth-v1.md`. If empty and table non-empty with no row for a user, that user has no env path. |

### Auto-provided (do NOT set manually)

| Variable | Notes |
|----------|-------|
| `VERCEL_URL` | Set automatically by Vercel |
| `NODE_ENV` | Set automatically (`production` on Vercel) |

## 3. External Service Configuration

### Supabase

- [ ] Site URL set to `https://martech.mn`
- [ ] Redirect URLs include `https://martech.mn/auth/callback`
- [ ] All migrations applied (check `supabase/migrations/`), including `202603220012_system_admins.sql` — see `docs/admin-bootstrap.md` (no duplicate SQL; use the migration file as the only source)
- [ ] Seed data applied (`supabase/seeds/`)
- [ ] RLS policies active on all tables

### Meta (Facebook)

- [ ] Facebook Login → Valid OAuth Redirect URI: `https://martech.mn/api/meta/callback`
- [ ] App Domains includes `martech.mn`
- [ ] Data Deletion Request URL: `https://martech.mn/api/meta/data-deletion`
- [ ] Required permissions approved: `pages_show_list`, `pages_read_engagement`

### QPay

- [ ] Callback URL reachable from QPay servers (no firewall blocking)
- [ ] QPay credentials tested with a small invoice

### Domain

- [ ] DNS points to Vercel
- [ ] HTTPS active (Vercel auto-provisions)
- [ ] `NEXT_PUBLIC_APP_URL` matches the live domain

## 4. Post-Deploy Verification

- [ ] `GET /api/health` returns `{ status: "ok", checks: { supabase_configured: true } }`
- [ ] Login page loads at `/login`
- [ ] Magic link email sends successfully
- [ ] Auth callback redirects to `/dashboard`
- [ ] Organization creation works at `/setup-organization`
- [ ] Meta connect flow completes at `/pages`
- [ ] System admin at `/admin` (DB `system_admins` + bootstrap) and legacy internal ops under `/internal/ops/*` work for operators
- [ ] 404 page renders at `/nonexistent-page`
- [ ] Privacy, Terms, Data Deletion pages load

## 5. Monitoring

- [ ] Set up uptime check on `GET /api/health`
- [ ] Vercel deployment notifications configured
- [ ] Error monitoring configured (Vercel Logs or Sentry)
