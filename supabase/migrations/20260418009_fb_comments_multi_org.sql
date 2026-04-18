-- Facebook Comment AI — Allow multi-org fan-out
-- Migration: 20260418009_fb_comments_multi_org.sql
--
-- Problem: the original schema marked fb_comments.comment_id UNIQUE globally,
-- so each Facebook comment could only be stored once. But in reality multiple
-- orgs can connect the SAME Facebook page (e.g. shared brand, multiple
-- tenants using the same page), and each org wants to react to incoming
-- comments with their own AI settings / knowledge base / page token.
--
-- Fix: drop the global UNIQUE constraint, replace with a composite
-- (org_id, comment_id) UNIQUE. Each (org, fb comment) pair is still
-- singular, but the same FB comment can land in multiple orgs' queues.

-- Drop the original global unique constraint. The column name is auto-named
-- by PostgreSQL (fb_comments_comment_id_key); use IF EXISTS for idempotency.
alter table public.fb_comments
  drop constraint if exists fb_comments_comment_id_key;

-- Composite uniqueness — still blocks duplicate webhook deliveries into the
-- same org (webhook idempotency), but allows fan-out across orgs.
alter table public.fb_comments
  add constraint fb_comments_org_comment_id_key unique (org_id, comment_id);

comment on constraint fb_comments_org_comment_id_key on public.fb_comments is
  'Per-org uniqueness for Facebook comment ingestion. Multiple orgs can connect the same page and each receive the comment exactly once.';
