-- Facebook Comment AI — Webhook retry columns
-- Migration: 20260418008_fb_comment_retry.sql
--
-- Adds retry bookkeeping so a transient failure (OpenAI 5xx, temporary
-- Supabase hiccup, expired FB page token later refreshed) doesn't leave the
-- comment permanently stuck in `failed`. A cron endpoint scans for rows
-- past their `next_retry_at` and re-runs processComment with exponential
-- backoff.
--
-- Retry budget is capped at 3 attempts via MAX_RETRIES in the cron handler.

alter table public.fb_comments
  add column if not exists retry_count int not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_error text;

comment on column public.fb_comments.retry_count is
  'Incremented each time processComment hits the top-level catch. 0 = never failed.';
comment on column public.fb_comments.next_retry_at is
  'When the retry cron should re-attempt processing. NULL when not queued for retry.';
comment on column public.fb_comments.last_error is
  'Truncated error message from the most recent failed attempt. For debugging.';

-- Partial index so the cron scan is cheap even with millions of rows.
create index if not exists fb_comments_retry_scan_idx
  on public.fb_comments (next_retry_at)
  where status = 'failed' and next_retry_at is not null;
