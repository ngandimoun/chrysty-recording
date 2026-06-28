-- BASELINE (already applied remotely as session_attachments — do not re-apply)

CREATE TABLE IF NOT EXISTS session_attachments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  gemini_file_uri TEXT,
  error_message TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_attachments_session ON session_attachments(session_id);
