-- Forward migration: session locale context for date/language-aware generation
-- MCP name: recording_worker_session_locale (apply only after user approval)

ALTER TABLE recording_sessions
  ADD COLUMN IF NOT EXISTS client_timezone TEXT,
  ADD COLUMN IF NOT EXISTS primary_language TEXT;
