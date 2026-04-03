-- Morning Digest: өглөөний мэдээллийн хураангуй
-- Маркетинг + бүтээлч салбарын өдөр тутмын digest

-- Эх сурвалжийн тохиргоо
CREATE TABLE digest_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  feed_url    text NOT NULL,
  home_url    text,
  category    text NOT NULL CHECK (category IN ('marketing', 'creative', 'ai_tools', 'trends')),
  language    text NOT NULL DEFAULT 'en',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Өдөр бүрийн digest session
CREATE TABLE digest_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date   date NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  summary_mn    text,          -- AI-ийн монгол хэлний ерөнхий хураангуй
  error_message text,
  item_count    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Тусдаа мэдээллийн нэгж
CREATE TABLE digest_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES digest_sessions(id) ON DELETE CASCADE,
  category         text NOT NULL CHECK (category IN ('marketing', 'creative', 'ai_tools', 'trends')),
  title_mn         text NOT NULL,   -- монгол хэлэнд орчуулсан гарчиг
  summary_mn       text NOT NULL,   -- 2-3 өгүүлбэрийн хураангуй
  source_name      text NOT NULL,
  source_url       text NOT NULL,
  original_title   text,
  published_at     timestamptz,
  importance_score int NOT NULL DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_digest_sessions_date ON digest_sessions(digest_date DESC);
CREATE INDEX idx_digest_sessions_status ON digest_sessions(status);
CREATE INDEX idx_digest_items_session ON digest_items(session_id);
CREATE INDEX idx_digest_items_category ON digest_items(session_id, category);
CREATE INDEX idx_digest_items_importance ON digest_items(session_id, importance_score DESC);
CREATE INDEX idx_digest_sources_active ON digest_sources(is_active, category);

-- RLS
ALTER TABLE digest_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_items ENABLE ROW LEVEL SECURITY;

-- Бүх нэвтэрсэн хэрэглэгч унших боломжтой (нийтлэг мэдлэгийн сан)
CREATE POLICY "digest_sources_read" ON digest_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "digest_sessions_read" ON digest_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "digest_items_read" ON digest_items FOR SELECT TO authenticated USING (true);

-- Service role only write
CREATE POLICY "digest_sources_service_write" ON digest_sources FOR ALL TO service_role USING (true);
CREATE POLICY "digest_sessions_service_write" ON digest_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "digest_items_service_write" ON digest_items FOR ALL TO service_role USING (true);

-- Seed: анхдагч эх сурвалжууд
INSERT INTO digest_sources (name, feed_url, home_url, category, language) VALUES
  -- Marketing
  ('HubSpot Blog', 'https://blog.hubspot.com/marketing/rss.xml', 'https://blog.hubspot.com/marketing', 'marketing', 'en'),
  ('Marketing Week', 'https://www.marketingweek.com/feed/', 'https://www.marketingweek.com', 'marketing', 'en'),
  ('Social Media Today', 'https://www.socialmediatoday.com/rss.xml', 'https://www.socialmediatoday.com', 'marketing', 'en'),
  ('Neil Patel Blog', 'https://neilpatel.com/blog/feed/', 'https://neilpatel.com/blog', 'marketing', 'en'),
  ('Search Engine Journal', 'https://www.searchenginejournal.com/feed/', 'https://www.searchenginejournal.com', 'marketing', 'en'),
  -- Creative
  ('Creativity Online', 'https://www.adsoftheworld.com/feed', 'https://www.adsoftheworld.com', 'creative', 'en'),
  ('Campaign US', 'https://www.campaignlive.com/rss', 'https://www.campaignlive.com', 'creative', 'en'),
  ('The Drum', 'https://www.thedrum.com/rss.xml', 'https://www.thedrum.com', 'creative', 'en'),
  -- AI Tools
  ('Marketing AI Institute', 'https://www.marketingaiinstitute.com/blog/rss.xml', 'https://www.marketingaiinstitute.com/blog', 'ai_tools', 'en'),
  ('VentureBeat AI', 'https://venturebeat.com/ai/feed/', 'https://venturebeat.com/ai', 'ai_tools', 'en'),
  -- Trends
  ('TechCrunch', 'https://techcrunch.com/feed/', 'https://techcrunch.com', 'trends', 'en'),
  ('Product Hunt', 'https://www.producthunt.com/feed', 'https://www.producthunt.com', 'trends', 'en');

-- updated_at auto-update
CREATE OR REPLACE FUNCTION update_digest_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER digest_sessions_updated_at
  BEFORE UPDATE ON digest_sessions
  FOR EACH ROW EXECUTE FUNCTION update_digest_sessions_updated_at();
