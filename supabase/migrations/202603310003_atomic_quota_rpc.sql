-- Atomically reserve one unit of quota.
-- Returns TRUE if the slot was reserved (counter incremented), FALSE if quota exceeded or reservation failed.
create or replace function public.reserve_quota(
  p_organization_id uuid,
  p_metric_key text,
  p_period_key text,
  p_limit bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_value bigint;
begin
  insert into public.usage_counters (organization_id, period_key, metric_key, value)
  values (p_organization_id, p_period_key, p_metric_key, 1)
  on conflict (organization_id, period_key, metric_key)
  do update
    set value = usage_counters.value + 1,
        updated_at = now()
    where usage_counters.value < p_limit
  returning value into v_new_value;

  -- If the row was not inserted or updated (limit was hit), v_new_value is NULL
  return v_new_value is not null;
end;
$$;

-- Atomically release (decrement) one unit — used to roll back a reservation on job failure.
create or replace function public.release_quota(
  p_organization_id uuid,
  p_metric_key text,
  p_period_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usage_counters
  set value = greatest(value - 1, 0),
      updated_at = now()
  where organization_id = p_organization_id
    and period_key = p_period_key
    and metric_key = p_metric_key;
end;
$$;
