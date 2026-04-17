-- Phase 2.4 (auth hardening): user-facing session list + revoke.
--
-- Supabase stores sessions in the protected `auth.sessions` table. RLS is
-- disabled on that schema by default; we expose only the current user's
-- sessions through security-definer RPCs so the app can render a
-- "logged-in devices" view and let users revoke stale sessions.

create or replace function public.list_my_sessions()
returns table(
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  ip text,
  user_agent text,
  factor_id uuid
)
language sql
security definer
set search_path = public, auth
as $$
  select
    s.id,
    s.created_at,
    s.updated_at,
    s.refreshed_at,
    s.not_after,
    s.ip::text,
    s.user_agent,
    s.factor_id
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc;
$$;

grant execute on function public.list_my_sessions() to authenticated;

create or replace function public.revoke_my_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deleted boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from auth.sessions
  where id = p_session_id
    and user_id = auth.uid();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.revoke_my_session(uuid) to authenticated;

-- Extend audit log with session revocation event.
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
    'session_revoked'
  ));
