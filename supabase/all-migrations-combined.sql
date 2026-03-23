-- Phase 2: Auth + Organization foundation

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = 'owner'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (user_id)
);

create unique index if not exists organization_members_one_active_owner_per_org_idx
  on public.organization_members (organization_id)
  where role = 'owner' and status = 'active';

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);

create index if not exists organizations_slug_idx
  on public.organizations (slug);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_member_orgs"
on public.organizations
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (true);

create policy "organizations_update_owner"
on public.organizations
for update
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role = 'owner'
      and om.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role = 'owner'
      and om.status = 'active'
  )
);

create policy "organization_members_select_same_org"
on public.organization_members
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy "organization_members_insert_self_owner_only"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
);
-- Phase 3: Plans + Subscription foundation

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly numeric(12, 2) not null check (price_monthly >= 0),
  currency text not null check (char_length(currency) = 3),
  max_pages integer not null check (max_pages > 0),
  syncs_per_day integer not null check (syncs_per_day > 0),
  monthly_ai_reports integer not null check (monthly_ai_reports >= 0),
  report_retention_days integer not null check (report_retention_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz null,
  last_billed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_key text not null,
  metric_key text not null check (metric_key in ('pages_connected', 'ai_reports_generated', 'manual_syncs_used')),
  value bigint not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, period_key, metric_key)
);

create index if not exists plans_code_idx on public.plans (code);
create index if not exists plans_is_active_idx on public.plans (is_active);
create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists usage_counters_org_period_idx on public.usage_counters (organization_id, period_key);

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row
execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists set_usage_counters_updated_at on public.usage_counters;
create trigger set_usage_counters_updated_at
before update on public.usage_counters
for each row
execute function public.set_updated_at();

create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
      and om.status = 'active'
  );
$$;

create or replace function public.bootstrap_organization_subscription(target_org_id uuid, target_plan_code text default 'starter')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan_id uuid;
  created_subscription_id uuid;
begin
  if not public.is_org_owner(target_org_id) then
    raise exception 'not allowed';
  end if;

  select id
  into selected_plan_id
  from public.plans
  where code = target_plan_code
    and is_active = true
  limit 1;

  if selected_plan_id is null then
    raise exception 'plan not found: %', target_plan_code;
  end if;

  insert into public.subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start
  )
  values (
    target_org_id,
    selected_plan_id,
    'active',
    now()
  )
  on conflict (organization_id) do update
  set
    updated_at = now()
  returning id into created_subscription_id;

  return created_subscription_id;
end;
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;

create policy "plans_select_active_public"
on public.plans
for select
to anon, authenticated
using (is_active = true);

create policy "subscriptions_select_owner_org"
on public.subscriptions
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "usage_counters_select_owner_org"
on public.usage_counters
for select
to authenticated
using (public.is_org_owner(organization_id));
-- Hardening for Phase 2 + Phase 3 before Meta integration

-- 1) Make subscription bootstrap semantics explicit for pre-billing state.
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('bootstrap_pending_billing', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'));

-- 2) Restrict direct writes that bypass transactional bootstrap flow.
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organization_members_insert_self_owner_only" on public.organization_members;

-- 3) Replace multi-step org creation with one transactional RPC.
create or replace function public.create_organization_with_starter(
  target_name text,
  target_slug text
)
returns table (
  organization_id uuid,
  organization_member_id uuid,
  subscription_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_org_id uuid;
  created_member_id uuid;
  starter_plan_id uuid;
  created_subscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
  ) then
    raise exception 'organization already exists for user';
  end if;

  select id
  into starter_plan_id
  from public.plans
  where code = 'starter'
    and is_active = true
  limit 1;

  if starter_plan_id is null then
    raise exception 'starter plan not seeded';
  end if;

  insert into public.organizations (name, slug, status)
  values (trim(target_name), target_slug, 'active')
  returning id into created_org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (created_org_id, auth.uid(), 'owner', 'active')
  returning id into created_member_id;

  insert into public.subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    trial_ends_at,
    last_billed_at
  )
  values (
    created_org_id,
    starter_plan_id,
    'bootstrap_pending_billing',
    now(),
    null,
    false,
    null,
    null
  )
  returning id into created_subscription_id;

  return query
  select created_org_id, created_member_id, created_subscription_id;
end;
$$;

revoke all on function public.create_organization_with_starter(text, text) from public;
grant execute on function public.create_organization_with_starter(text, text) to authenticated;

-- 4) Restrict bootstrap function to deterministic starter-only path.
create or replace function public.bootstrap_organization_subscription(
  target_org_id uuid,
  target_plan_code text default 'starter'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan_id uuid;
  created_subscription_id uuid;
begin
  if target_plan_code <> 'starter' then
    raise exception 'paid plan selection requires billing integration';
  end if;

  if not public.is_org_owner(target_org_id) then
    raise exception 'not allowed';
  end if;

  select id
  into selected_plan_id
  from public.plans
  where code = 'starter'
    and is_active = true
  limit 1;

  if selected_plan_id is null then
    raise exception 'starter plan not found';
  end if;

  insert into public.subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start
  )
  values (
    target_org_id,
    selected_plan_id,
    'bootstrap_pending_billing',
    now()
  )
  on conflict (organization_id) do update
  set
    plan_id = excluded.plan_id,
    status = excluded.status,
    updated_at = now()
  returning id into created_subscription_id;

  return created_subscription_id;
end;
$$;
-- Phase 4: Meta OAuth + page connection foundation

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  meta_user_id text null,
  access_token_encrypted text null,
  refresh_token_encrypted text null,
  token_expires_at timestamptz null,
  granted_scopes text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked', 'error')),
  last_validated_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_connection_id uuid not null references public.meta_connections(id) on delete cascade,
  meta_page_id text not null,
  name text not null,
  category text null,
  page_access_token_encrypted text null,
  is_selectable boolean not null default true,
  is_selected boolean not null default false,
  status text not null default 'active' check (status in ('active', 'deselected', 'revoked', 'error')),
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, meta_page_id)
);

create index if not exists meta_connections_org_idx on public.meta_connections (organization_id);
create index if not exists meta_connections_status_idx on public.meta_connections (status);
create index if not exists meta_pages_org_idx on public.meta_pages (organization_id);
create index if not exists meta_pages_conn_idx on public.meta_pages (meta_connection_id);
create index if not exists meta_pages_selected_idx on public.meta_pages (organization_id, is_selected);

drop trigger if exists set_meta_connections_updated_at on public.meta_connections;
create trigger set_meta_connections_updated_at
before update on public.meta_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_meta_pages_updated_at on public.meta_pages;
create trigger set_meta_pages_updated_at
before update on public.meta_pages
for each row
execute function public.set_updated_at();

create or replace function public.get_plan_max_pages(target_org_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select p.max_pages
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.organization_id = target_org_id
    and s.status in ('bootstrap_pending_billing', 'trialing', 'active')
  limit 1;
$$;

create or replace function public.set_meta_page_selected(
  target_org_id uuid,
  target_meta_page_id uuid,
  target_selected boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_max_pages integer;
  selected_count integer;
begin
  if not public.is_org_owner(target_org_id) then
    raise exception 'not allowed';
  end if;

  if target_selected then
    allowed_max_pages := public.get_plan_max_pages(target_org_id);
    if allowed_max_pages is null then
      raise exception 'subscription plan not found';
    end if;

    select count(*)
    into selected_count
    from public.meta_pages mp
    where mp.organization_id = target_org_id
      and mp.is_selected = true
      and mp.status = 'active'
      and mp.id <> target_meta_page_id;

    if selected_count >= allowed_max_pages then
      raise exception 'plan page limit reached';
    end if;
  end if;

  if target_selected and exists (
    select 1
    from public.meta_pages mp
    where mp.id = target_meta_page_id
      and mp.organization_id = target_org_id
      and mp.is_selectable = false
  ) then
    raise exception 'page is not selectable';
  end if;

  update public.meta_pages mp
  set
    is_selected = target_selected,
    status = case
      when target_selected and mp.status in ('active', 'deselected') then 'active'
      when not target_selected and mp.status in ('active', 'deselected') then 'deselected'
      else mp.status
    end,
    updated_at = now()
  where mp.id = target_meta_page_id
    and mp.organization_id = target_org_id;

  if not found then
    raise exception 'meta page not found';
  end if;

  return true;
end;
$$;

revoke all on function public.set_meta_page_selected(uuid, uuid, boolean) from public;
grant execute on function public.set_meta_page_selected(uuid, uuid, boolean) to authenticated;

alter table public.meta_connections enable row level security;
alter table public.meta_pages enable row level security;

create policy "meta_connections_select_owner_org"
on public.meta_connections
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "meta_pages_select_owner_org"
on public.meta_pages
for select
to authenticated
using (public.is_org_owner(organization_id));
-- Phase 5: Meta sync pipeline + normalized metrics (no AI)

create table if not exists public.meta_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  job_type text not null check (job_type in ('initial_sync', 'scheduled_sync', 'manual_sync')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key text not null unique,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.page_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  metric_date date not null,
  followers_count integer null,
  follower_delta integer null,
  reach integer null,
  impressions integer null,
  engaged_users integer null,
  post_count integer null,
  engagement_rate numeric null,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (meta_page_id, metric_date)
);

create table if not exists public.page_post_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  meta_post_id text not null,
  post_created_at timestamptz not null,
  message_excerpt text null,
  post_type text null,
  reach integer null,
  impressions integer null,
  engagements integer null,
  reactions integer null,
  comments integer null,
  shares integer null,
  clicks integer null,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meta_page_id, meta_post_id)
);

create index if not exists meta_sync_jobs_org_idx on public.meta_sync_jobs (organization_id);
create index if not exists meta_sync_jobs_page_idx on public.meta_sync_jobs (meta_page_id);
create index if not exists meta_sync_jobs_status_idx on public.meta_sync_jobs (status);
create index if not exists meta_sync_jobs_scheduled_idx on public.meta_sync_jobs (scheduled_at);

create index if not exists page_daily_metrics_org_idx on public.page_daily_metrics (organization_id);
create index if not exists page_daily_metrics_page_date_idx on public.page_daily_metrics (meta_page_id, metric_date desc);

create index if not exists page_post_metrics_org_idx on public.page_post_metrics (organization_id);
create index if not exists page_post_metrics_page_idx on public.page_post_metrics (meta_page_id);

drop trigger if exists set_page_post_metrics_updated_at on public.page_post_metrics;
create trigger set_page_post_metrics_updated_at
before update on public.page_post_metrics
for each row
execute function public.set_updated_at();

alter table public.meta_sync_jobs enable row level security;
alter table public.page_daily_metrics enable row level security;
alter table public.page_post_metrics enable row level security;

create policy "meta_sync_jobs_select_owner_org"
on public.meta_sync_jobs
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "page_daily_metrics_select_owner_org"
on public.page_daily_metrics
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "page_post_metrics_select_owner_org"
on public.page_post_metrics
for select
to authenticated
using (public.is_org_owner(organization_id));
-- Phase 6: AI analysis jobs, reports, recommendations (no billing)

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  source_sync_job_id uuid null references public.meta_sync_jobs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key text not null unique,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  analysis_job_id uuid null references public.analysis_jobs(id) on delete set null,
  report_type text not null check (report_type in ('daily_summary', 'weekly_summary', 'manual_analysis')),
  status text not null default 'ready' check (status in ('ready', 'failed', 'superseded')),
  summary text not null default '',
  findings_json jsonb not null default '[]'::jsonb,
  recommendations_json jsonb not null default '[]'::jsonb,
  model_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meta_page_id uuid not null references public.meta_pages(id) on delete cascade,
  analysis_report_id uuid not null references public.analysis_reports(id) on delete cascade,
  priority text not null check (priority in ('high', 'medium', 'low')),
  category text not null check (category in ('content', 'timing', 'engagement', 'growth')),
  title text not null,
  description text not null,
  action_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analysis_jobs_org_idx on public.analysis_jobs (organization_id);
create index if not exists analysis_jobs_page_idx on public.analysis_jobs (meta_page_id);
create index if not exists analysis_jobs_status_idx on public.analysis_jobs (status);
create index if not exists analysis_jobs_sync_source_idx on public.analysis_jobs (source_sync_job_id);

create index if not exists analysis_reports_org_idx on public.analysis_reports (organization_id);
create index if not exists analysis_reports_page_idx on public.analysis_reports (meta_page_id);
create index if not exists analysis_reports_status_idx on public.analysis_reports (status);
create index if not exists analysis_reports_created_idx on public.analysis_reports (meta_page_id, created_at desc);

create index if not exists recommendations_org_idx on public.recommendations (organization_id);
create index if not exists recommendations_page_idx on public.recommendations (meta_page_id);
create index if not exists recommendations_report_idx on public.recommendations (analysis_report_id);

alter table public.analysis_jobs enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.recommendations enable row level security;

create policy "analysis_jobs_select_owner_org"
on public.analysis_jobs
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "analysis_reports_select_owner_org"
on public.analysis_reports
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "recommendations_select_owner_org"
on public.recommendations
for select
to authenticated
using (public.is_org_owner(organization_id));
-- Phase 6 hardening: job payload for triggers / future scheduling; explicit operational metadata

alter table public.analysis_jobs
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists analysis_jobs_created_idx on public.analysis_jobs (meta_page_id, created_at desc);
-- Phase 7: Billing + QPay foundation (invoices, payment_transactions, billing_events)

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  target_plan_id uuid not null references public.plans (id),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  status text not null check (status in ('pending', 'paid', 'expired', 'failed', 'canceled')),
  provider text not null default 'qpay' check (provider = 'qpay'),
  provider_invoice_id text null,
  provider_payment_url text null,
  qpay_sender_invoice_no text not null,
  webhook_verify_token text not null,
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  paid_at timestamptz null,
  idempotency_key text null,
  provider_last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_qpay_sender_invoice_no_key unique (qpay_sender_invoice_no)
);

create index if not exists invoices_idempotency_key_idx on public.invoices (idempotency_key)
  where idempotency_key is not null;

create index if not exists invoices_org_created_idx on public.invoices (organization_id, created_at desc);
create index if not exists invoices_org_status_idx on public.invoices (organization_id, status);
create index if not exists invoices_provider_invoice_idx on public.invoices (provider_invoice_id)
  where provider_invoice_id is not null;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'qpay',
  provider_txn_id text null,
  status text not null check (status in ('pending', 'initiated', 'paid', 'failed', 'reversed')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  raw_payload jsonb not null default '{}'::jsonb,
  verification_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz null,
  last_verification_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_invoice_idx on public.payment_transactions (invoice_id);
create index if not exists payment_transactions_org_created_idx
  on public.payment_transactions (organization_id, created_at desc);

create unique index if not exists payment_transactions_provider_txn_uidx
  on public.payment_transactions (provider, provider_txn_id)
  where provider_txn_id is not null;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations (id) on delete set null,
  invoice_id uuid null references public.invoices (id) on delete set null,
  event_type text not null,
  provider_event_id text null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz null,
  processing_error text null,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_org_created_idx on public.billing_events (organization_id, created_at desc);
create index if not exists billing_events_invoice_idx on public.billing_events (invoice_id, created_at desc);

create unique index if not exists billing_events_provider_event_uidx
  on public.billing_events (provider_event_id)
  where provider_event_id is not null;

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at
before update on public.payment_transactions
for each row
execute function public.set_updated_at();

-- RLS: owners read own org rows only; no client writes (service role bypasses RLS)
alter table public.invoices enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.billing_events enable row level security;

create policy "invoices_select_owner_org"
on public.invoices
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "payment_transactions_select_owner_org"
on public.payment_transactions
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy "billing_events_select_owner_org"
on public.billing_events
for select
to authenticated
using (
  organization_id is not null
  and public.is_org_owner(organization_id)
);
-- Phase 7 hardening: verification audit trail on invoices (reconciliation / retries / recovery)

alter table public.invoices
  add column if not exists verification_attempt_count integer not null default 0 check (verification_attempt_count >= 0),
  add column if not exists last_verification_at timestamptz null,
  add column if not exists last_verification_outcome text null;

comment on column public.invoices.verification_attempt_count is 'Number of provider verification round-trips (payment/check); for retries and reconciliation.';
comment on column public.invoices.last_verification_at is 'Last time we called the payment provider to verify this invoice.';
comment on column public.invoices.last_verification_outcome is 'Short outcome code from last verification (e.g. paid_confirmed, not_paid_yet, qpay_error).';
-- Private beta: append-only audit log for operator/support actions (service role writes only).

create table if not exists public.operator_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action_type text not null,
  organization_id uuid null references public.organizations (id) on delete set null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operator_audit_events_created_idx on public.operator_audit_events (created_at desc);
create index if not exists operator_audit_events_org_idx on public.operator_audit_events (organization_id, created_at desc);
create index if not exists operator_audit_events_action_idx on public.operator_audit_events (action_type, created_at desc);

comment on table public.operator_audit_events is 'Support/operator actions (reverify, job retries). No client RLS policies — reads via service role in internal tools only.';

alter table public.operator_audit_events enable row level security;
insert into public.plans (
  code,
  name,
  price_monthly,
  currency,
  max_pages,
  syncs_per_day,
  monthly_ai_reports,
  report_retention_days,
  is_active
)
values
  ('starter', 'Starter', 29.00, 'USD', 1, 1, 30, 30, true),
  ('growth', 'Growth', 99.00, 'USD', 5, 4, 120, 90, true)
on conflict (code) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  currency = excluded.currency,
  max_pages = excluded.max_pages,
  syncs_per_day = excluded.syncs_per_day,
  monthly_ai_reports = excluded.monthly_ai_reports,
  report_retention_days = excluded.report_retention_days,
  is_active = excluded.is_active,
  updated_at = now();

-- 202603230001_meta_connections_meta_user_id_idx.sql
create index if not exists meta_connections_meta_user_id_idx
  on public.meta_connections (meta_user_id)
  where meta_user_id is not null;
