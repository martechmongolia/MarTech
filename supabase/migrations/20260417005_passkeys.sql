-- Phase 3.2 (auth hardening): WebAuthn / Passkey credential storage.
--
-- Each row is one registered authenticator (hardware key / biometric /
-- passkey) tied to a user. Lookups by credential_id during login.
-- Enforced unique per user + per credential to prevent duplicate registration.

create table if not exists public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[] null,
  friendly_name text null,
  device_type text null,
  backed_up boolean not null default false,
  last_used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists user_passkeys_user_id_idx on public.user_passkeys(user_id);

alter table public.user_passkeys enable row level security;

-- Users can read their own credentials (for the settings UI listing).
create policy "user_passkeys_select_own"
on public.user_passkeys
for select
using (user_id = auth.uid());

-- Users can delete their own (unenroll).
create policy "user_passkeys_delete_own"
on public.user_passkeys
for delete
using (user_id = auth.uid());

-- Registration/authentication challenges — short-lived rows, looked up by
-- user_id + challenge + purpose. We store these to verify replay between
-- start/finish endpoints since WebAuthn challenges must be one-time.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete cascade,
  email text null,
  challenge text not null,
  purpose text not null check (purpose in ('register', 'login')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists webauthn_challenges_lookup_idx
  on public.webauthn_challenges(user_id, purpose, created_at desc);
create index if not exists webauthn_challenges_email_idx
  on public.webauthn_challenges(lower(email), purpose, created_at desc)
  where email is not null;

alter table public.webauthn_challenges enable row level security;
-- No public RLS policies — only service-role API routes read/write these.

-- Extend auth event types.
alter table public.auth_events
  drop constraint if exists auth_events_event_type_check;

alter table public.auth_events
  add constraint auth_events_event_type_check
  check (event_type in (
    'login_magic_sent',
    'login_magic_used',
    'login_google_success',
    'login_failed',
    'logout',
    'signup',
    'org_created',
    'consent_accepted',
    'account_deletion_requested',
    'mfa_enroll_started',
    'mfa_enrolled',
    'mfa_challenge_passed',
    'mfa_challenge_failed',
    'mfa_unenrolled',
    'org_invitation_sent',
    'org_invitation_accepted',
    'org_invitation_revoked',
    'org_invitation_declined',
    'session_revoked',
    'passkey_registered',
    'passkey_login_success',
    'passkey_login_failed',
    'passkey_removed'
  ));
