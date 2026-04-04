-- Turn state persistence: brainstorm_sessions хүснэгтэд нэмэлт багана
ALTER TABLE brainstorm_sessions
  ADD COLUMN IF NOT EXISTS current_agent_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_phase TEXT NOT NULL DEFAULT 'agent_speaking'
    CHECK (current_phase IN ('agent_speaking', 'waiting_user', 'round_transition', 'completed')),
  ADD COLUMN IF NOT EXISTS turn_state JSONB;

-- Index for active sessions lookup
CREATE INDEX IF NOT EXISTS idx_sessions_status_user
  ON brainstorm_sessions(user_id, status);
