-- ============================================================
-- Brainstorm — Session Type & Constraint Text (MVP Techniques)
-- ============================================================

ALTER TABLE brainstorm_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'six_hats'
    CHECK (session_type IN ('six_hats', 'round_robin', 'disney', 'scamper', 'free_flow')),
  ADD COLUMN IF NOT EXISTS constraint_text TEXT;
