-- Add Facebook Comment AI settings to existing meta_pages table
ALTER TABLE meta_pages 
  ADD COLUMN IF NOT EXISTS comment_ai_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment_ai_settings jsonb DEFAULT '{}';

-- comment_ai_settings JSON structure:
-- { auto_reply: bool, tone: string, working_hours_start: string, working_hours_end: string,
--   reply_delay_seconds: int, custom_system_prompt: string, fallback_message: string }
