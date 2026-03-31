# Architecture

MarTech MVP v1 — System components, boundaries, and integration patterns.

---

## Overview

MarTech is a Next.js (App Router) SaaS platform that connects Facebook/Instagram business pages,
syncs performance metrics via the Meta API, and generates AI-powered analytics reports.

**Stack:** Next.js 15 · Supabase (Postgres + Auth + Storage) · QPay (billing) · Meta Graph API · OpenAI

---

## Module Map

```
src/
├── app/                    Next.js App Router (pages, API routes, webhooks)
│   ├── api/webhooks/qpay/  QPay payment callback
│   └── (dashboard)/        Authenticated dashboard pages
├── modules/
│   ├── auth/               Session helpers, getCurrentUser
│   ├── organizations/      Org data access
│   ├── subscriptions/      Plans, entitlements, usage counters
│   │   ├── entitlements.ts         Feature limit checks (read)
│   │   └── usage-admin.ts          Atomic counter increments (write via RPC)
│   ├── billing/            Checkout, invoice, payment, activation
│   │   ├── create-checkout.ts      QPay invoice creation + supersede old invoices
│   │   ├── layer-invoice.ts        Invoice row persistence
│   │   ├── layer-target-plan.ts    Checkout intent validation
│   │   ├── layer-verification.ts   QPay payment verification (read-only)
│   │   ├── layer-subscription-activation.ts  Guarded subscription state transition
│   │   ├── subscription-transitions.ts       Pure transition logic
│   │   └── webhook-handler.ts      QPay webhook event processing
│   ├── sync/               Meta API sync jobs
│   │   ├── enqueue.ts              Create meta_sync_jobs row
│   │   ├── execute-meta-sync.ts    End-to-end sync executor (CAS-locked)
│   │   └── actions.ts              Server actions (manual sync, retry)
│   ├── ai/                 AI analysis jobs
│   │   ├── enqueue-analysis.ts     Create analysis_jobs row
│   │   ├── execute-analysis-job.ts Job executor (CAS-locked, quota-reserved)
│   │   ├── entitlements-org.ts     AI quota check by org (no user session)
│   │   ├── metrics-reader.ts       Load normalized metrics for LLM input
│   │   ├── llm-input-construction.ts Build LLM prompt
│   │   ├── llm-adapter.ts          OpenAI call + deterministic fallback
│   │   ├── signals.ts              Deterministic signal extraction
│   │   └── persist-report.ts       Write analysis results to DB
│   └── meta/               Meta page connection, token management
└── lib/
    ├── supabase/            admin + server + browser clients
    ├── meta/                Meta Graph API client, crypto helpers
    └── env/                 Typed env accessors
```

---

## Key State Machines

### 1. Subscription Status

```
bootstrap_pending_billing
        │
        ▼ (paid invoice verified)
     active ◄──────────────────── trialing
        │
        ├── canceled (manual cancel)
        ├── expired  (period end, no renewal)
        └── suspended (admin action)
```

**Rules:**
- Only `layer-subscription-activation.ts` may set status → `active` from billing
- Transition is guarded: only `bootstrap_pending_billing`, `trialing`, or re-activating the same plan
- A stale/superseded invoice cannot flip an already-active subscription to a different plan

### 2. Invoice Status

```
  pending
    │
    ├── canceled  (superseded by new checkout, or activation guard blocked)
    ├── failed    (QPay invoice creation failed)
    ├── expired   (due_at passed, not paid)
    └── paid      (verified + subscription activated)
```

**Rules:**
- When a new checkout starts, all OTHER pending invoices for the same subscription are set to `canceled`
- Activation only proceeds if the invoice is `pending` at the time of verification (idempotent lock via conditional update)
- A `canceled` or already-`paid` invoice cannot trigger another activation

### 3. Sync Job Status (`meta_sync_jobs`)

```
pending → running → succeeded
              └──→ failed (retryable)
canceled (manual)
```

**Concurrency:** CAS lock — update to `running` only if `status IN ('pending', 'failed')`.
If 0 rows updated, another process claimed the job → bail out silently.

### 4. Analysis Job Status (`analysis_jobs`)

```
pending → running → succeeded
              └──→ failed (retryable)
```

**Concurrency:** Same CAS lock pattern as sync jobs.
**Quota:** Atomically reserved via `reserve_quota()` RPC before execution starts.
On failure, quota is released via `release_quota()` RPC.

---

## Concurrency & Safety Patterns

### Job Execution: Compare-and-Swap (CAS) Lock

Both `executeMetaSyncJob` and `executeAnalysisJob` use a DB-level CAS to claim jobs:

```typescript
const { data: claimed } = await admin
  .from("meta_sync_jobs")        // or analysis_jobs
  .update({ status: "running", ... })
  .eq("id", jobId)
  .in("status", ["pending", "failed"])  // ← CAS condition
  .select("id");

if (!claimed || claimed.length === 0) return; // another process won
```

This prevents duplicate execution even under concurrent retries or webhook replays.

### Quota Enforcement: Atomic Reserve-then-Run

Usage counters are updated via Supabase RPC functions (`reserve_quota`, `release_quota`),
not application-level read-modify-write. This eliminates the race where two concurrent requests
both read the same counter value and both increment to the same result.

```
reserve_quota(org_id, metric_key, period_key, limit)
  → INSERT ... ON CONFLICT DO UPDATE SET value = value + 1 WHERE value < limit
  → returns TRUE (reserved) or FALSE (quota full)
```

**Flow:**
1. Check entitlement (subscription status, plan limits)
2. `reserve_quota()` — atomic increment, returns false if over limit
3. Execute job
4. On success: quota slot is already consumed ✅
5. On failure: `release_quota()` rolls back the reservation

### Billing: Supersede + Activation Guard

Two layers prevent a stale invoice from overwriting an active subscription:

**Layer 1 — Checkout start:** `cancelSupersededPendingInvoices()` sets all other pending invoices
for the subscription to `canceled` before the QPay invoice is created.

**Layer 2 — Activation guard:** `applySubscriptionTransitionAfterVerifiedPayment()` uses a
conditional update that only succeeds if the subscription is in `bootstrap_pending_billing`,
`trialing`, or already `active` on the *same* plan. If a different plan is already active,
the invoice is marked `canceled` and an audit event is written.

---

## Billing Flow

```
User clicks "Pay"
      │
      ▼
startPaidPlanCheckoutAction (actions.ts)
      │  validates org + plan
      ▼
createPaidPlanCheckout (create-checkout.ts)
      │  1. validateCheckoutTargetAgainstSubscription
      │  2. insertPendingInvoiceRecord
      │  3. cancelSupersededPendingInvoices  ← supersede old invoices
      │  4. qpayCreateInvoice (external)
      │  5. updateInvoiceAfterProviderInvoiceCreated
      ▼
QPay QR shown to user
      │
      ▼ (user pays in bank app)
      │
QPay webhook → /api/webhooks/qpay
      │  1. verify token
      │  2. load invoice
      │  3. runProviderVerificationForInvoice (read-only QPay check)
      │  4. canApplyPaidPlanAfterVerification (pure logic gate)
      │  5. applySubscriptionTransitionAfterVerifiedPayment
      │     ├── lock invoice (pending → paid, conditional)
      │     ├── update subscription (guarded by status filter)
      │     └── write billing_event "subscription_activated"
      ▼
Subscription active ✅
```

---

## Meta Sync Flow

```
User clicks "Sync"
      │
      ▼
manualSyncPageAction (sync/actions.ts)
      │  checkOrganizationFeatureLimit("manual_sync")
      ▼
enqueueMetaSyncJob → creates meta_sync_jobs row (status: pending)
      │
      ▼
executeMetaSyncJob
      │  1. load job row
      │  2. CAS update → running (bail if already claimed)
      │  3. fetch + decrypt page token
      │  4. Meta API: page insights + post metrics
      │  5. upsert page_daily_metrics + page_post_metrics
      │  6. mark job succeeded
      │  7. incrementManualSyncUsage (best-effort, atomic RPC)
      │  8. schedulePostSyncAnalysis (triggers analysis job)
      ▼
Analysis job enqueued → executeAnalysisJob (same pattern + quota reserve)
```

---

## Database Tables (key)

| Table | Purpose |
|---|---|
| `organizations` | Tenant units |
| `subscriptions` | One per org; tracks plan + status |
| `plans` | Plan definitions (limits, price) |
| `invoices` | Payment intents; status machine: pending→paid/canceled/failed/expired |
| `payment_transactions` | Provider-level payment records |
| `billing_events` | Immutable audit log for all billing state changes |
| `usage_counters` | Per-org, per-period feature usage (daily/monthly) |
| `meta_connections` | OAuth token store for Meta pages |
| `meta_pages` | Connected page registry |
| `meta_sync_jobs` | Sync job queue + status |
| `analysis_jobs` | AI analysis job queue + status |
| `page_daily_metrics` | Aggregated daily page performance |
| `page_post_metrics` | Per-post metrics |
| `analysis_reports` | Persisted AI analysis output |

---

## Security Notes

- All server-side DB writes use the Supabase **service role** (admin) client
- User-facing reads use the **server** client (respects RLS)
- RLS policies enforce org ownership on all tenant tables
- Webhook endpoints validate `webhook_verify_token` before processing
- Meta access tokens are encrypted at rest (`lib/meta/crypto.ts`)
- Billing activation is idempotent — duplicate webhooks cannot double-activate

---

## Known Engineering Decisions

- **No Phyllo** — Meta + YouTube APIs used directly (more control, lower cost)
- **QPay only** — Mongolian market; Stripe/international billing is a future phase
- **Sync is synchronous** — jobs run in-request for now; Phase 6+ will use a worker queue
- **AI fallback** — if LLM call fails, deterministic signal-based analysis is returned instead
