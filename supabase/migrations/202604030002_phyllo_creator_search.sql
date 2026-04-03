-- Phyllo Creator Search
-- Tables: phyllo_creator_searches, phyllo_creators, phyllo_saved_creators

-- ─────────────────────────────────────────────
-- 1. phyllo_creator_searches — search job хадгалах
-- ─────────────────────────────────────────────
create table public.phyllo_creator_searches (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.organizations(id) on delete cascade,
  work_platform_id  text        not null,
  sort_field        text        not null default 'AVERAGE_VIEWS',
  sort_order        text        not null default 'DESCENDING',
  follower_min      integer,
  follower_max      integer,
  keywords          text,
  status            text        not null default 'completed',
  result_count      integer,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 2. phyllo_creators — creator хадгалах
-- ─────────────────────────────────────────────
create table public.phyllo_creators (
  id                uuid          primary key default gen_random_uuid(),
  organization_id   uuid          not null references public.organizations(id) on delete cascade,
  search_id         uuid          not null references public.phyllo_creator_searches(id) on delete cascade,
  work_platform_id  text          not null,
  platform_username text,
  full_name         text,
  profile_pic_url   text,
  follower_count    integer,
  average_likes     numeric(12,2),
  average_views     numeric(12,2),
  average_comments  numeric(12,2),
  is_verified       boolean       default false,
  external_id       text,
  url               text,
  raw_data          jsonb,
  created_at        timestamptz   default now()
);

-- ─────────────────────────────────────────────
-- 3. phyllo_saved_creators — хадгалсан creator
-- ─────────────────────────────────────────────
create table public.phyllo_saved_creators (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.organizations(id) on delete cascade,
  creator_id        uuid        not null references public.phyllo_creators(id) on delete cascade,
  note              text,
  created_at        timestamptz default now(),
  unique (organization_id, creator_id)
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index phyllo_creator_searches_organization_id_idx
  on public.phyllo_creator_searches (organization_id);

create index phyllo_creator_searches_work_platform_id_idx
  on public.phyllo_creator_searches (work_platform_id);

create index phyllo_creators_organization_id_idx
  on public.phyllo_creators (organization_id);

create index phyllo_creators_work_platform_id_idx
  on public.phyllo_creators (work_platform_id);

create index phyllo_creators_follower_count_idx
  on public.phyllo_creators (follower_count);

create index phyllo_creators_search_id_idx
  on public.phyllo_creators (search_id);

create index phyllo_saved_creators_organization_id_idx
  on public.phyllo_saved_creators (organization_id);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.phyllo_creator_searches  enable row level security;
alter table public.phyllo_creators          enable row level security;
alter table public.phyllo_saved_creators    enable row level security;

-- phyllo_creator_searches
create policy "phyllo_creator_searches_select_owner_org"
  on public.phyllo_creator_searches
  for select
  to authenticated
  using (public.is_org_owner(organization_id));

create policy "phyllo_creator_searches_insert_owner_org"
  on public.phyllo_creator_searches
  for insert
  to authenticated
  with check (public.is_org_owner(organization_id));

create policy "phyllo_creator_searches_update_owner_org"
  on public.phyllo_creator_searches
  for update
  to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

create policy "phyllo_creator_searches_delete_owner_org"
  on public.phyllo_creator_searches
  for delete
  to authenticated
  using (public.is_org_owner(organization_id));

-- phyllo_creators (organization_id шууд байгаа тул direct check)
create policy "phyllo_creators_select_owner_org"
  on public.phyllo_creators
  for select
  to authenticated
  using (public.is_org_owner(organization_id));

create policy "phyllo_creators_insert_owner_org"
  on public.phyllo_creators
  for insert
  to authenticated
  with check (public.is_org_owner(organization_id));

create policy "phyllo_creators_update_owner_org"
  on public.phyllo_creators
  for update
  to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

create policy "phyllo_creators_delete_owner_org"
  on public.phyllo_creators
  for delete
  to authenticated
  using (public.is_org_owner(organization_id));

-- phyllo_saved_creators
create policy "phyllo_saved_creators_select_owner_org"
  on public.phyllo_saved_creators
  for select
  to authenticated
  using (public.is_org_owner(organization_id));

create policy "phyllo_saved_creators_insert_owner_org"
  on public.phyllo_saved_creators
  for insert
  to authenticated
  with check (public.is_org_owner(organization_id));

create policy "phyllo_saved_creators_update_owner_org"
  on public.phyllo_saved_creators
  for update
  to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

create policy "phyllo_saved_creators_delete_owner_org"
  on public.phyllo_saved_creators
  for delete
  to authenticated
  using (public.is_org_owner(organization_id));
