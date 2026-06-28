-- BASELINE (already applied remotely as chrysty_recording_schema — do not re-apply)
-- Recording worker core tables for chrysty.dev

CREATE TABLE IF NOT EXISTS recording_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'uploading',
  audio_path TEXT,
  use_case TEXT NOT NULL DEFAULT 'knowledge_capture',
  transcript TEXT,
  transcript_detail JSONB,
  gemini_file_uri TEXT,
  gemini_interaction_ids JSONB,
  processing_step INT NOT NULL DEFAULT 0,
  duration_seconds INT,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_objects (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  status TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_recording_id TEXT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  mention_count INT DEFAULT 1,
  source_quote TEXT,
  preview_content TEXT,
  related_object_ids JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS voice_history_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_interaction_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights_snapshots (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
