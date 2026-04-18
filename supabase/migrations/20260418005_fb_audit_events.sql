-- Facebook Comment AI — Audit log of state transitions
-- Migration: 20260418005_fb_audit_events.sql
--
-- Purpose: records every meaningful state change on fb_comments and fb_replies
-- (approved, rejected, posted, hidden, etc.) together with the actor who
-- triggered it. Without this, we cannot answer "who approved this reply?" or
-- reconstruct why a comment ended up in a given status.
--
-- Writes happen server-side via the admin/service-role client from the
-- facebook-ai module. No user-facing INSERT policy — clients can only SELECT.

create table if not exists public.fb_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  event_type text not null check (event_type in (
    'comment.status_changed',
    'reply.approved',
    'reply.rejected',
    'reply.posted',
    'reply.post_failed',
    'comment.rate_limited'
  )),
  comment_id uuid references fb_comments(id) on delete cascade,
  reply_id uuid references fb_replies(id) on delete cascade,
  actor_user_id uuid references profiles(id) on delete set null,
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.fb_audit_events is
  'Append-only audit trail for Facebook Comment AI state transitions. actor_user_id NULL = system/webhook-triggered.';
comment on column public.fb_audit_events.actor_user_id is
  'NULL for system-triggered events (webhook, auto-reply). Set to profiles.id for operator actions.';

create index if not exists fb_audit_events_org_created_at_idx
  on public.fb_audit_events (org_id, created_at desc);

create index if not exists fb_audit_events_comment_created_at_idx
  on public.fb_audit_events (comment_id, created_at desc)
  where comment_id is not null;

create index if not exists fb_audit_events_reply_created_at_idx
  on public.fb_audit_events (reply_id, created_at desc)
  where reply_id is not null;

create index if not exists fb_audit_events_event_type_created_at_idx
  on public.fb_audit_events (event_type, created_at desc);

alter table public.fb_audit_events enable row level security;

drop policy if exists "Org members read fb_audit_events" on public.fb_audit_events;
create policy "Org members read fb_audit_events" on public.fb_audit_events
  for select using (
    org_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "Service role bypass fb_audit_events" on public.fb_audit_events;
create policy "Service role bypass fb_audit_events" on public.fb_audit_events
  for all to service_role using (true);
