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
  ('starter', 'Starter', 49900.00, 'MNT', 1, 1, 30, 30, true),
  ('growth', 'Growth', 149900.00, 'MNT', 5, 4, 120, 90, true)
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
