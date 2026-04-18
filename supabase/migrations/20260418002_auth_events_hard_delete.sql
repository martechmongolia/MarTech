-- Phase 2.1: хатуу устгалын үйл явдлыг auth_events-д бичихэд зориулна.
--
-- auth_events.event_type CHECK constraint-д 'account_deletion_completed'
-- нэмнэ. Scheduled cron /api/cron/account-hard-delete grace period-ийн дараа
-- admin.auth.admin.deleteUser-г дуудахдаа энэ event-ийг лог хийнэ.

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
