-- Phase 2.2: TOTP MFA-д нөөцийн код (recovery codes) нэмэх.
--
-- Хэрэглэгч TOTP enroll хийх үед 10 ширхэг нэг удаагийн код үүсгэж,
-- `code_hash` талбарт `salt.hash` (хоёулаа base64url) форматаар
-- хадгална. Challenge page-д хэрэглэгч recovery code оруулахад тухайн
-- row-г consume (used_at set) хийж, TOTP factor-уудыг нэгэн зэрэг
-- unenroll болгоно. Үүний үр дүнд шинэ төхөөрөмж дээр MFA-г дахин
-- enroll хийх боломжтой.

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_id_idx
  on public.mfa_recovery_codes(user_id);

-- Идэвхтэй (used_at = null) кодуудыг хурдан түүвэрлэх partial index.
create index if not exists mfa_recovery_codes_user_active_idx
  on public.mfa_recovery_codes(user_id)
  where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- Хэрэглэгч зөвхөн өөрийн мөрүүдийг SELECT хийнэ.
-- Insert/update/delete нь admin client (service role)-оос л хийгдэнэ.
create policy "mfa_recovery_codes_select_own"
on public.mfa_recovery_codes
for select
using (user_id = auth.uid());

-- auth_events.event_type-д 3 шинэ утга нэмэх.
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
    'account_deletion_completed',
    'mfa_enroll_started',
    'mfa_enrolled',
    'mfa_challenge_passed',
    'mfa_challenge_failed',
    'mfa_unenrolled',
    'mfa_recovery_codes_generated',
    'mfa_recovery_code_used',
    'mfa_recovery_codes_revoked',
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
