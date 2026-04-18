-- Phase 1 (auth hardening follow-up): user-initiated soft delete.
--
-- Adds `deleted_at` + `status` to profiles. Account deletion flow sets these
-- columns instead of hard-deleting the auth.users row so the user has a
-- 30-day grace window. A scheduled job (Phase 2) runs
-- admin.auth.admin.deleteUser(id) for rows with
-- `deleted_at < now() - interval '30 days'`; the existing FK CASCADE chain
-- then cleans up profiles/members/passkeys/challenges/sessions.
--
-- Middleware uses `status` + `deleted_at` to force signOut on any request
-- from a deleted or suspended user. RLS on profiles is intentionally left
-- permissive on SELECT so the account-recovery UI (Phase 2) can still read
-- the row during the grace period.

alter table public.profiles
  add column if not exists deleted_at timestamptz null,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'deleted', 'suspended'));

-- Partial index drives the future scheduled hard-delete job.
create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;

comment on column public.profiles.deleted_at is
  'Account устгах хүсэлт илгээсэн цаг. NULL = идэвхтэй. 30 өдрийн дараа scheduled job hard-delete хийнэ.';

comment on column public.profiles.status is
  'active | deleted | suspended. Middleware deleted/suspended хэрэглэгчийг request бүрт signOut хийнэ.';
