-- Facebook Comment AI — Consolidate connections onto meta_pages
-- Migration: 20260414001_fb_ai_meta_pages_consolidation.sql
--
-- Rationale: The original migration (20260404008) created a separate
-- fb_page_connections table, but the application code stores connection
-- references using meta_pages.id UUIDs. The foreign keys never match,
-- so fb_comments inserts would fail in production.
--
-- This migration makes meta_pages the single source of truth:
--   1. Re-points fb_comments.connection_id FK to meta_pages(id)
--   2. Re-points fb_reply_settings.connection_id FK to meta_pages(id)
--   3. Rewrites the fb_reply_settings RLS policy to join through meta_pages
--   4. Drops the unused fb_page_connections table
--   5. Adds meta_pages.webhook_subscribed_at for per-page webhook state

-- ============================================================
-- 1. Re-point fb_comments.connection_id FK to meta_pages(id)
-- ============================================================
ALTER TABLE fb_comments DROP CONSTRAINT IF EXISTS fb_comments_connection_id_fkey;
ALTER TABLE fb_comments
  ADD CONSTRAINT fb_comments_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES meta_pages(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Re-point fb_reply_settings.connection_id FK to meta_pages(id)
-- ============================================================
ALTER TABLE fb_reply_settings DROP CONSTRAINT IF EXISTS fb_reply_settings_connection_id_fkey;
ALTER TABLE fb_reply_settings
  ADD CONSTRAINT fb_reply_settings_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES meta_pages(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Rewrite fb_reply_settings RLS policy (old policy referenced the
--    fb_page_connections table that we are about to drop).
-- ============================================================
DROP POLICY IF EXISTS "Org members access fb_reply_settings" ON fb_reply_settings;
CREATE POLICY "Org members access fb_reply_settings" ON fb_reply_settings
  FOR ALL USING (
    connection_id IN (
      SELECT id FROM meta_pages
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypass policy is already defined in migration 008 and does not
-- depend on fb_page_connections, so we leave it in place.

-- ============================================================
-- 4. Drop the unused fb_page_connections table
-- ============================================================
DROP TABLE IF EXISTS fb_page_connections CASCADE;

-- ============================================================
-- 5. Add per-page webhook subscription timestamp
-- ============================================================
ALTER TABLE meta_pages
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at timestamptz;
