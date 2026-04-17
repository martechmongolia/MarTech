-- Phase 1 (Auth hardening): consent tracking + auth event audit log
-- - profiles.tos_version/tos_accepted_at: explicit ToS acceptance record (GDPR)
-- - auth_events: structured audit log for login/signup/logout/consent events

-- ─── 1. Consent tracking on profiles ────────────────────────────────────────

alter table public.profiles
  add column if not exists tos_version text null,
  add column if not exists tos_accepted_at timestamptz null,
  add column if not exists tos_accepted_ip text null;

comment on column public.profiles.tos_version is 'Version string of the ToS/Privacy document the user accepted.';
comment on column public.profiles.tos_accepted_at is 'When the user explicitly accepted ToS. NULL means legacy user; ToS gate will prompt them.';
comment on column public.profiles.tos_accepted_ip is 'Client IP at the time of consent. For audit/compliance only.';

-- ─── 2. Auth audit log ──────────────────────────────────────────────────────

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  email text null,
  event_type text not null check (event_type in (
    'login_magic_sent',
    'login_magic_used',
    'login_google_success',
    'login_failed',
    'logout',
    'signup',
    'org_created',
    'consent_accepted',
    'account_deletion_requested'
  )),
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_events_user_id_created_at_idx
  on public.auth_events (user_id, created_at desc);

create index if not exists auth_events_event_type_created_at_idx
  on public.auth_events (event_type, created_at desc);

create index if not exists auth_events_email_created_at_idx
  on public.auth_events (email, created_at desc)
  where email is not null;

alter table public.auth_events enable row level security;

-- Users can read only their own auth events (viewable in /settings/activity later)
create policy "auth_events_select_own"
on public.auth_events
for select
using (user_id = auth.uid());

-- Writes go through service-role admin client (server actions only). No user-facing insert policy.
-- System admins can read everything via separate admin guard — no RLS override needed here.

comment on table public.auth_events is 'Structured audit log for authentication + onboarding events. Written server-side via admin client.';
