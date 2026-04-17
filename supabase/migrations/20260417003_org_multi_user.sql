-- Phase 2.1 (auth hardening): multi-user orgs + invitations
--
-- Changes:
--   1. Drop the unique(user_id) constraint on organization_members so a user
--      can be a member of any org (still bounded to one org in practice
--      because the invite flow checks existing membership — we just no longer
--      enforce it at the DB level). The `unique(organization_id, user_id)` is
--      retained so a user can't appear twice in the same org.
--   2. Expand the role check constraint to include 'admin' and 'member'.
--   3. Create organization_invitations with RLS + accept RPC.
--
-- Rollback:
--   drop function public.accept_organization_invitation(text);
--   drop table public.organization_invitations;
--   alter table public.organization_members
--     drop constraint organization_members_role_check,
--     add constraint organization_members_role_check check (role = 'owner'),
--     add constraint organization_members_user_id_key unique (user_id);

-- ─── 1. Member constraints ───────────────────────────────────────────────────

alter table public.organization_members
  drop constraint if exists organization_members_user_id_key;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- ─── 2. Invitations table ────────────────────────────────────────────────────

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz null,
  accepted_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_invitations_org_idx
  on public.organization_invitations(organization_id);
create index if not exists organization_invitations_email_lower_idx
  on public.organization_invitations(lower(email));

alter table public.organization_invitations enable row level security;

-- Members of the target org can read invitations (so they see the pending list).
create policy "invitations_select_org_members"
on public.organization_invitations
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

-- Only owner/admin can issue invitations.
create policy "invitations_insert_admin_or_owner"
on public.organization_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.status = 'active'
  )
);

-- Only owner/admin can update (revoke) invitations. Acceptance happens via
-- the security-definer RPC below, not via direct updates.
create policy "invitations_update_admin_or_owner"
on public.organization_invitations
for update
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.status = 'active'
  )
);

-- ─── 3. Accept RPC (atomic; bypasses RLS for the multi-table write) ──────────

create or replace function public.accept_organization_invitation(p_token text)
returns table(organization_id uuid, organization_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_user_email text;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_user_email from public.profiles where id = v_user_id;
  if v_user_email is null then
    raise exception 'profile_not_found';
  end if;

  select * into v_invitation from public.organization_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_%', v_invitation.status;
  end if;

  if v_invitation.expires_at < now() then
    update public.organization_invitations
    set status = 'expired'
    where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;

  if lower(v_invitation.email) <> lower(v_user_email) then
    raise exception 'invitation_email_mismatch';
  end if;

  update public.organization_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invitation.organization_id, v_user_id, v_invitation.role, 'active')
  on conflict (organization_id, user_id)
  do update set status = 'active', role = excluded.role;

  return query
  select o.id, o.name from public.organizations o where o.id = v_invitation.organization_id;
end;
$$;

grant execute on function public.accept_organization_invitation(text) to authenticated;

-- ─── 4. Audit event types — extend for invitation lifecycle ─────────────────

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
    'org_invitation_declined'
  ));
