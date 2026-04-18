-- Facebook Comment AI — Daily aggregated metrics
-- Migration: 20260418007_fb_metrics_daily.sql
--
-- Purpose: per-(org, day, metric) counters for dashboarding and cost tracking.
-- An append-only `fb_metric_events` table would give exact per-event detail
-- but would bloat fast. Aggregated daily rows are cheap, queryable, and
-- enough for "how many replies today / this month / which tokens cost what".
--
-- Increments happen via the app's admin client (bypasses RLS). Reads are
-- gated to org members so team leads can see their own usage.

create table if not exists public.fb_metrics_daily (
  org_id uuid not null references organizations(id) on delete cascade,
  day date not null,
  metric text not null check (metric in (
    'comments.received',
    'comments.processed',
    'comments.failed',
    'comments.rate_limited',
    'replies.drafted',
    'replies.posted.auto',
    'replies.posted.manual',
    'replies.approved',
    'replies.rejected',
    'replies.post_failed',
    'openai.calls',
    'openai.errors',
    'openai.tokens'
  )),
  count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, day, metric)
);

comment on table public.fb_metrics_daily is
  'Per-org per-day aggregate counters for Facebook Comment AI. Written via admin client; read scoped to org members.';
comment on column public.fb_metrics_daily.count is
  'Incremented via UPSERT with `count = count + delta`. For token counts this is absolute token count, not calls.';

create index if not exists fb_metrics_daily_day_idx
  on public.fb_metrics_daily (day desc);

create index if not exists fb_metrics_daily_org_day_idx
  on public.fb_metrics_daily (org_id, day desc);

alter table public.fb_metrics_daily enable row level security;

drop policy if exists "Org members read fb_metrics_daily" on public.fb_metrics_daily;
create policy "Org members read fb_metrics_daily" on public.fb_metrics_daily
  for select using (
    org_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "Service role bypass fb_metrics_daily" on public.fb_metrics_daily;
create policy "Service role bypass fb_metrics_daily" on public.fb_metrics_daily
  for all to service_role using (true);

-- Atomic increment helper. Supabase does not expose a "insert ... on conflict
-- do update set count = count + excluded.count" idiom through the typed query
-- builder for composite-PK tables; wrap it in a function so the app calls
-- rpc('fb_metric_increment', {...}) with a single round-trip.
create or replace function public.fb_metric_increment(
  p_org_id uuid,
  p_metric text,
  p_delta bigint default 1,
  p_day date default (now() at time zone 'Asia/Ulaanbaatar')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fb_metrics_daily (org_id, day, metric, count, updated_at)
  values (p_org_id, p_day, p_metric, p_delta, now())
  on conflict (org_id, day, metric)
  do update set
    count = public.fb_metrics_daily.count + excluded.count,
    updated_at = now();
end;
$$;

revoke execute on function public.fb_metric_increment(uuid, text, bigint, date) from public;
grant execute on function public.fb_metric_increment(uuid, text, bigint, date) to service_role;
