-- Brainstorm Messages table
create table if not exists public.brainstorm_messages (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.brainstorm_sessions(id) on delete cascade,
  role              text not null check (role in ('user', 'agent', 'system')),
  agent_id          text,  -- null when role = 'user'
  content           text not null default '',
  round_number      int not null default 1,
  turn_index        int not null default 0,
  mentioned_agent_id text,  -- optional @mention
  is_streaming      boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Indexes
create index if not exists brainstorm_messages_session_id_idx on public.brainstorm_messages(session_id);
create index if not exists brainstorm_messages_session_round_idx on public.brainstorm_messages(session_id, round_number, turn_index);
create index if not exists brainstorm_messages_created_at_idx on public.brainstorm_messages(created_at);

-- Full-text search index (DB-05)
create index if not exists brainstorm_messages_content_fts_idx
  on public.brainstorm_messages
  using gin(to_tsvector('simple', content));
