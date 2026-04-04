-- Smart Post Generator: Vector infrastructure + RAG schema
-- Phase: AI content generation with past-post similarity search

-- Enable pgvector (may already exist)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. Post embeddings table (index past posts for RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  meta_page_id uuid REFERENCES meta_pages(id) ON DELETE SET NULL,
  post_id text NOT NULL, -- Facebook post ID
  content text NOT NULL, -- post message text
  embedding vector(1536), -- OpenAI text-embedding-3-small

  -- Engagement signals (for weighted retrieval)
  reach int DEFAULT 0,
  likes int DEFAULT 0,
  comments int DEFAULT 0,
  shares int DEFAULT 0,
  engagement_rate numeric(6,4) DEFAULT 0,
  engagement_score numeric(10,4) DEFAULT 0, -- computed: weighted sum

  -- Metadata
  posted_at timestamptz,
  content_type text DEFAULT 'text' CHECK (content_type IN ('text', 'photo', 'video', 'reel', 'story', 'link')),
  language text DEFAULT 'mn',
  created_at timestamptz DEFAULT now(),

  UNIQUE(org_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_org
  ON post_embeddings(org_id);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_score
  ON post_embeddings(org_id, engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_vector
  ON post_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access post_embeddings"
  ON post_embeddings FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service bypass post_embeddings"
  ON post_embeddings FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- 2. Generated posts (drafts + history)
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  meta_page_id uuid REFERENCES meta_pages(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Input
  topic text NOT NULL,
  tone text DEFAULT 'friendly' CHECK (tone IN ('friendly', 'professional', 'funny', 'informative', 'urgent')),
  content_type text DEFAULT 'text',
  additional_context text,

  -- Output
  generated_content text NOT NULL,
  alternative_versions jsonb DEFAULT '[]', -- array of alternative drafts

  -- RAG context used
  source_post_ids text[], -- which past posts were used as reference
  performance_prediction jsonb, -- predicted reach/engagement based on similar posts

  -- Scheduling
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'rejected')),
  scheduled_at timestamptz,
  published_at timestamptz,
  facebook_post_id text, -- ID after publishing

  -- Meta
  model_used text DEFAULT 'gpt-4o-mini',
  tokens_used int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_posts_org
  ON generated_posts(org_id);

CREATE INDEX IF NOT EXISTS idx_generated_posts_status
  ON generated_posts(org_id, status);

ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access generated_posts"
  ON generated_posts FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service bypass generated_posts"
  ON generated_posts FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- 3. RPC: Hybrid search (vector similarity + engagement weighting)
-- ============================================================
CREATE OR REPLACE FUNCTION search_similar_posts(
  p_org_id uuid,
  p_embedding vector(1536),
  p_limit int DEFAULT 10,
  p_min_engagement numeric DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  post_id text,
  content text,
  engagement_score numeric,
  engagement_rate numeric,
  reach int,
  likes int,
  comments int,
  shares int,
  posted_at timestamptz,
  content_type text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id,
    pe.post_id,
    pe.content,
    pe.engagement_score,
    pe.engagement_rate,
    pe.reach,
    pe.likes,
    pe.comments,
    pe.shares,
    pe.posted_at,
    pe.content_type,
    (1 - (pe.embedding <=> p_embedding))::float AS similarity
  FROM post_embeddings pe
  WHERE pe.org_id = p_org_id
    AND pe.embedding IS NOT NULL
    AND pe.engagement_score >= p_min_engagement
    AND pe.content IS NOT NULL
    AND length(pe.content) > 10
  ORDER BY
    -- Hybrid: 70% vector similarity + 30% engagement weight
    (
      0.7 * (1 - (pe.embedding <=> p_embedding))
      + 0.3 * (
        pe.engagement_score
        / NULLIF(
            (SELECT MAX(engagement_score) FROM post_embeddings WHERE org_id = p_org_id),
            0
          )
      )
    ) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_similar_posts(uuid, vector, int, numeric) TO authenticated;

-- ============================================================
-- 4. Track indexing status per page
-- ============================================================
ALTER TABLE meta_pages
  ADD COLUMN IF NOT EXISTS posts_indexed_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_last_indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS smart_generator_enabled boolean DEFAULT true;
