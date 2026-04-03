-- Feature flags: системийн үйлчилгээнүүдийг admin-аас идэвхжүүлэх/хаах
-- Service flag нь хэрэглэгчдэд навигаци болон хуудасны харагдалтыг хянана

CREATE TABLE feature_flags (
  key         text PRIMARY KEY,           -- e.g. 'social_listening', 'creator_search'
  label       text NOT NULL,             -- Human-readable: "Social Listening"
  enabled     boolean NOT NULL DEFAULT true,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text                       -- admin email
);

-- RLS: бүх authenticated хэрэглэгч унших боломжтой, зөвхөн service role бичнэ
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_read" ON feature_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "feature_flags_service_write" ON feature_flags
  FOR ALL TO service_role USING (true);

-- updated_at auto-update
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_feature_flags_updated_at();

-- Анхдагч flags — одоогийн sidebar цэстэй тохирсон
INSERT INTO feature_flags (key, label, enabled, description) VALUES
  ('social_listening',  'Social Listening',    true,  'Phyllo API-аар TikTok/Instagram хайлт'),
  ('creator_search',    'Creator Search',      true,  'Influencer хайх модул'),
  ('morning_digest',    'Өглөөний Мэдээлэл',   true,  'Өдөр тутмын маркетингийн хураангуй'),
  ('brand_managers',    'AI Brand Managers',   true,  'AI брэнд менежер модул'),
  ('pages',             'Pages',               true,  'Meta хуудасны удирдлага');
