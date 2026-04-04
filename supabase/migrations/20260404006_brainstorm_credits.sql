-- ============================================================
-- Brainstorm Credit & Payment System
-- ============================================================

-- Brainstorming credit тохиргоо (admin тохируулна)
CREATE TABLE brainstorm_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  session_price_amount INTEGER NOT NULL DEFAULT 500, -- ₮ нэг session-ийн үнэ
  session_price_currency TEXT NOT NULL DEFAULT 'MNT',
  starter_monthly_credits INTEGER NOT NULL DEFAULT 5,
  growth_monthly_credits INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Singleton seed
INSERT INTO brainstorm_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Хэрэглэгчийн credit үлдэгдэл
CREATE TABLE brainstorm_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMPTZ,
  last_refill_plan_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Credit transaction log
CREATE TABLE brainstorm_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- + нэмэх, - хасах
  type TEXT NOT NULL CHECK (type IN ('plan_refill', 'one_time_purchase', 'session_use', 'admin_grant')),
  session_id UUID REFERENCES brainstorm_sessions(id),
  invoice_id TEXT, -- QPay invoice_id (string)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE brainstorm_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE brainstorm_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brainstorm_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own credits" ON brainstorm_credits FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Own transactions" ON brainstorm_credit_transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Anyone reads config" ON brainstorm_config FOR SELECT USING (true);

-- Index
CREATE INDEX idx_brainstorm_credits_user ON brainstorm_credits(user_id);
CREATE INDEX idx_brainstorm_credit_tx_user ON brainstorm_credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_brainstorm_credit_tx_invoice ON brainstorm_credit_transactions(invoice_id);
