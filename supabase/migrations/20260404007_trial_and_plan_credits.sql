-- Plan хүснэгтэд brainstorm credit нэмэх
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS brainstorm_credits_monthly INTEGER NOT NULL DEFAULT 0;

-- Одоогийн plan-уудыг update
UPDATE plans SET brainstorm_credits_monthly = 5  WHERE code = 'starter';
UPDATE plans SET brainstorm_credits_monthly = 20 WHERE code = 'growth';

-- Trial config (brainstorm_config-д нэмэх)
ALTER TABLE brainstorm_config
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS trial_brainstorm_credits INTEGER NOT NULL DEFAULT 20;
