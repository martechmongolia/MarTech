-- Phyllo Social Listening + Hashtag Trends
-- Tables: phyllo_social_searches, phyllo_search_results, phyllo_hashtag_trends

-- ─────────────────────────────────────────────
-- 1. phyllo_social_searches — search job хадгалах
-- ─────────────────────────────────────────────
create table public.phyllo_social_searches (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.organizations(id) on delete cascade,
  phyllo_search_id  text        unique,                          -- Phyllo-ийн буцаасан search ID
  search_type       text        not null,                        -- 'keyword' | 'hashtag' | 'mention'
  query             text        not null,                        -- хайлтын текст
  work_platform_id  text        not null,                        -- Phyllo platform UUID (TikTok, Instagram …)
  status            text        not null default 'pending',      -- pending | in_progress | completed | failed
  result_count      integer,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. phyllo_search_results — хайлтын үр дүн
-- ─────────────────────────────────────────────
create table public.phyllo_search_results (
  id                uuid        primary key default gen_random_uuid(),
  search_id         uuid        not null references public.phyllo_social_searches(id) on delete cascade,
  content_id        text,                                        -- Phyllo контентийн ID
  platform          text        not null,
  url               text,
  title             text,
  description       text,
  thumbnail_url     text,
  creator_name      text,
  creator_handle    text,
  creator_followers integer,
  like_count        integer,
  comment_count     integer,
  share_count       integer,
  view_count        integer,
  engagement_rate   numeric(5,4),
  published_at      timestamptz,
  raw_data          jsonb,                                       -- бүтэн Phyllo response
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 3. phyllo_hashtag_trends — hashtag trend хадгалах
-- ─────────────────────────────────────────────
create table public.phyllo_hashtag_trends (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null references public.organizations(id) on delete cascade,
  hashtag             text        not null,
  platform            text        not null,
  post_count          integer,
  total_engagement    bigint,
  avg_engagement_rate numeric(5,4),
  top_content         jsonb,                                     -- top 3 контент snapshot
  snapshot_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index phyllo_social_searches_organization_id_idx
  on public.phyllo_social_searches (organization_id);

create index phyllo_social_searches_status_idx
  on public.phyllo_social_searches (status);

create index phyllo_social_searches_search_type_idx
  on public.phyllo_social_searches (search_type);

create index phyllo_search_results_search_id_idx
  on public.phyllo_search_results (search_id);

create index phyllo_hashtag_trends_organization_id_idx
  on public.phyllo_hashtag_trends (organization_id);

create index phyllo_hashtag_trends_hashtag_platform_idx
  on public.phyllo_hashtag_trends (hashtag, platform);

-- ─────────────────────────────────────────────
-- RLS — organization_id-д тулгуурласан (meta_connections pattern)
-- ─────────────────────────────────────────────
alter table public.phyllo_social_searches  enable row level security;
alter table public.phyllo_search_results   enable row level security;
alter table public.phyllo_hashtag_trends   enable row level security;

-- phyllo_social_searches
create policy "phyllo_social_searches_select_owner_org"
  on public.phyllo_social_searches
  for select
  to authenticated
  using (public.is_org_owner(organization_id));

create policy "phyllo_social_searches_insert_owner_org"
  on public.phyllo_social_searches
  for insert
  to authenticated
  with check (public.is_org_owner(organization_id));

create policy "phyllo_social_searches_update_owner_org"
  on public.phyllo_social_searches
  for update
  to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

create policy "phyllo_social_searches_delete_owner_org"
  on public.phyllo_social_searches
  for delete
  to authenticated
  using (public.is_org_owner(organization_id));

-- phyllo_search_results (search_id → organization_id через join)
create policy "phyllo_search_results_select_owner_org"
  on public.phyllo_search_results
  for select
  to authenticated
  using (
    exists (
      select 1 from public.phyllo_social_searches s
      where s.id = search_id
        and public.is_org_owner(s.organization_id)
    )
  );

create policy "phyllo_search_results_insert_owner_org"
  on public.phyllo_search_results
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.phyllo_social_searches s
      where s.id = search_id
        and public.is_org_owner(s.organization_id)
    )
  );

create policy "phyllo_search_results_delete_owner_org"
  on public.phyllo_search_results
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.phyllo_social_searches s
      where s.id = search_id
        and public.is_org_owner(s.organization_id)
    )
  );

-- phyllo_hashtag_trends
create policy "phyllo_hashtag_trends_select_owner_org"
  on public.phyllo_hashtag_trends
  for select
  to authenticated
  using (public.is_org_owner(organization_id));

create policy "phyllo_hashtag_trends_insert_owner_org"
  on public.phyllo_hashtag_trends
  for insert
  to authenticated
  with check (public.is_org_owner(organization_id));

create policy "phyllo_hashtag_trends_delete_owner_org"
  on public.phyllo_hashtag_trends
  for delete
  to authenticated
  using (public.is_org_owner(organization_id));
