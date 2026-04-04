-- Brainstorm Sessions table
create table if not exists public.brainstorm_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic       text not null,
  total_rounds int not null default 3,
  current_round int not null default 0,
  status      text not null default 'pending'
                check (status in ('pending', 'active', 'completed', 'cancelled')),
  language    text not null default 'mn',
  active_agents text[] not null default array['marketer','analyst','skeptic','idealist','psychologist','moderator'],
  user_turn_mode text not null default 'end_of_round'
                check (user_turn_mode in ('end_of_round', 'after_each', 'none')),
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes
create index if not exists brainstorm_sessions_user_id_idx on public.brainstorm_sessions(user_id);
create index if not exists brainstorm_sessions_status_idx on public.brainstorm_sessions(status);
create index if not exists brainstorm_sessions_created_at_idx on public.brainstorm_sessions(created_at desc);
