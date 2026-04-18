-- Phase 2.3: email-change flow support.
--
-- 1. auth_events-д 2 шинэ event type (email_change_requested,
--    email_change_completed) нэмэх.
-- 2. handle_auth_user_created trigger-ийг INSERT+UPDATE хоёулан дээр
--    ажилладаг болгож, supabase.auth.updateUser({email}) амжилттай
--    болсны дараа profiles.email автомат шинэчлэгддэг болгоно. Үгүй
--    бол auth.users.email шинэчлэгдсэн ч profiles.email хуучин хэвээр
--    үлдэж, манай RLS/сервер код зөрчилдөнө.

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
    'email_change_requested',
    'email_change_completed',
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

-- Upsert семантик + UPDATE-д мөн fire хийх.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email
    where public.profiles.email is distinct from excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row
execute function public.handle_auth_user_created();
