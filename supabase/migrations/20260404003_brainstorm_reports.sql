-- Brainstorm Reports table
create table if not exists public.brainstorm_reports (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.brainstorm_sessions(id) on delete cascade,
  content      text not null default '',
  summary      text not null default '',
  top_ideas    jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists brainstorm_reports_session_id_idx on public.brainstorm_reports(session_id);

-- RLS Policies (DB-04) — applied to all three tables
alter table public.brainstorm_sessions  enable row level security;
alter table public.brainstorm_messages  enable row level security;
alter table public.brainstorm_reports   enable row level security;

-- brainstorm_sessions policies
create policy "users can select own sessions"
  on public.brainstorm_sessions for select
  using (auth.uid() = user_id);

create policy "users can insert own sessions"
  on public.brainstorm_sessions for insert
  with check (auth.uid() = user_id);

create policy "users can update own sessions"
  on public.brainstorm_sessions for update
  using (auth.uid() = user_id);

create policy "users can delete own sessions"
  on public.brainstorm_sessions for delete
  using (auth.uid() = user_id);

-- brainstorm_messages policies (join through session ownership)
create policy "users can select own session messages"
  on public.brainstorm_messages for select
  using (
    exists (
      select 1 from public.brainstorm_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "users can insert own session messages"
  on public.brainstorm_messages for insert
  with check (
    exists (
      select 1 from public.brainstorm_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "users can update own session messages"
  on public.brainstorm_messages for update
  using (
    exists (
      select 1 from public.brainstorm_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- brainstorm_reports policies
create policy "users can select own session reports"
  on public.brainstorm_reports for select
  using (
    exists (
      select 1 from public.brainstorm_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "service role bypass for reports"
  on public.brainstorm_reports for all
  using (auth.role() = 'service_role');

-- Seed data (DB-06) — example demo sessions (dev only, skipped in prod via check)
do $$
begin
  -- Only seed in non-production environments (feature-flag controlled)
  -- Actual seed rows would be inserted here for dev/staging
  null;
end $$;
