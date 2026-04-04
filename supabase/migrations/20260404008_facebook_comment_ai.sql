-- Facebook Comment AI — Database Schema
-- Migration: 20260404008_facebook_comment_ai.sql

-- Enable pgvector extension for semantic search (knowledge base embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. Facebook Page connections (OAuth)
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_page_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  page_id text NOT NULL,
  page_name text NOT NULL,
  page_access_token text NOT NULL, -- encrypted at application layer
  token_expires_at timestamptz,
  webhook_subscribed boolean DEFAULT false,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}', -- reply settings, tone, hours
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, page_id)
);

CREATE TRIGGER set_fb_page_connections_updated_at
  BEFORE UPDATE ON fb_page_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Incoming comments from Facebook
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES fb_page_connections(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  comment_id text NOT NULL UNIQUE, -- Facebook comment ID
  post_id text NOT NULL,
  parent_comment_id text, -- if it's a reply to another comment
  commenter_name text,
  commenter_id text,
  message text NOT NULL,
  comment_type text DEFAULT 'unknown' CHECK (comment_type IN ('question', 'complaint', 'spam', 'irrelevant', 'positive', 'order', 'unknown')),
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  language text DEFAULT 'mn',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'replied', 'skipped', 'failed', 'hidden')),
  created_at_facebook timestamptz,
  received_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. AI generated replies
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES fb_comments(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  draft_message text NOT NULL,
  final_message text, -- after human edit
  model_used text DEFAULT 'gpt-4o-mini',
  confidence_score numeric(3,2), -- 0.00 to 1.00
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'rejected', 'edited_posted')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  posted_at timestamptz,
  facebook_reply_id text, -- ID returned by Facebook after posting
  tokens_used int,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Knowledge base (FAQ + product info per org)
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN ('faq', 'product', 'policy', 'contact', 'general')),
  embedding vector(1536), -- pgvector for semantic search
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_fb_knowledge_base_updated_at
  BEFORE UPDATE ON fb_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. Reply settings per page
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_reply_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES fb_page_connections(id) ON DELETE CASCADE UNIQUE,
  auto_reply boolean DEFAULT false, -- true = auto post, false = human approval
  reply_tone text DEFAULT 'friendly' CHECK (reply_tone IN ('friendly', 'professional', 'casual')),
  reply_language text DEFAULT 'mn',
  reply_delay_seconds int DEFAULT 30,
  working_hours_start time DEFAULT '08:00',
  working_hours_end time DEFAULT '22:00',
  working_days int[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon..7=Sun
  max_replies_per_day int DEFAULT 500,
  custom_system_prompt text,
  fallback_message text DEFAULT 'Асуултыг хүлээн авлаа, манай team эрт хариулах болно. 😊',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_fb_reply_settings_updated_at
  BEFORE UPDATE ON fb_reply_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. Reply usage tracking (for billing)
-- ============================================================
CREATE TABLE IF NOT EXISTS fb_reply_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  month date NOT NULL, -- first day of month
  replies_used int DEFAULT 0,
  replies_limit int DEFAULT 200,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, month)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fb_comments_connection ON fb_comments(connection_id);
CREATE INDEX IF NOT EXISTS idx_fb_comments_status ON fb_comments(status);
CREATE INDEX IF NOT EXISTS idx_fb_comments_org ON fb_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_fb_replies_comment ON fb_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_fb_knowledge_base_org ON fb_knowledge_base(org_id);
CREATE INDEX IF NOT EXISTS idx_fb_knowledge_base_embedding ON fb_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE fb_page_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_reply_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_reply_usage ENABLE ROW LEVEL SECURITY;

-- fb_page_connections: org members + service role bypass
DROP POLICY IF EXISTS "Org members access fb_page_connections" ON fb_page_connections;
CREATE POLICY "Org members access fb_page_connections" ON fb_page_connections
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_page_connections" ON fb_page_connections;
CREATE POLICY "Service role bypass fb_page_connections" ON fb_page_connections
  FOR ALL TO service_role USING (true);

-- fb_comments
DROP POLICY IF EXISTS "Org members access fb_comments" ON fb_comments;
CREATE POLICY "Org members access fb_comments" ON fb_comments
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_comments" ON fb_comments;
CREATE POLICY "Service role bypass fb_comments" ON fb_comments
  FOR ALL TO service_role USING (true);

-- fb_replies
DROP POLICY IF EXISTS "Org members access fb_replies" ON fb_replies;
CREATE POLICY "Org members access fb_replies" ON fb_replies
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_replies" ON fb_replies;
CREATE POLICY "Service role bypass fb_replies" ON fb_replies
  FOR ALL TO service_role USING (true);

-- fb_knowledge_base
DROP POLICY IF EXISTS "Org members access fb_knowledge_base" ON fb_knowledge_base;
CREATE POLICY "Org members access fb_knowledge_base" ON fb_knowledge_base
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_knowledge_base" ON fb_knowledge_base;
CREATE POLICY "Service role bypass fb_knowledge_base" ON fb_knowledge_base
  FOR ALL TO service_role USING (true);

-- fb_reply_settings (accessed via connection → page → org)
DROP POLICY IF EXISTS "Org members access fb_reply_settings" ON fb_reply_settings;
CREATE POLICY "Org members access fb_reply_settings" ON fb_reply_settings
  FOR ALL USING (
    connection_id IN (
      SELECT id FROM fb_page_connections
      WHERE org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_reply_settings" ON fb_reply_settings;
CREATE POLICY "Service role bypass fb_reply_settings" ON fb_reply_settings
  FOR ALL TO service_role USING (true);

-- fb_reply_usage
DROP POLICY IF EXISTS "Org members access fb_reply_usage" ON fb_reply_usage;
CREATE POLICY "Org members access fb_reply_usage" ON fb_reply_usage
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role bypass fb_reply_usage" ON fb_reply_usage;
CREATE POLICY "Service role bypass fb_reply_usage" ON fb_reply_usage
  FOR ALL TO service_role USING (true);
