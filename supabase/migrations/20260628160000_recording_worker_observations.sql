-- Forward migration: observation layer (canonical understanding per session)
-- Remote name: recording_worker_observations (apply after user approval)

CREATE TABLE IF NOT EXISTS recording_observations (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_quote TEXT,
  source_timestamp TEXT,
  change_type TEXT NOT NULL DEFAULT 'new',
  canonical_key TEXT,
  supersedes_id TEXT REFERENCES recording_observations(id) ON DELETE SET NULL,
  affected_entity_keys TEXT[] DEFAULT '{}',
  attributes JSONB DEFAULT '{}'::jsonb,
  importance REAL,
  short_term_importance REAL,
  confidence REAL,
  novelty REAL,
  update_existing BOOLEAN DEFAULT FALSE,
  create_new BOOLEAN DEFAULT TRUE,
  needs_follow_up BOOLEAN DEFAULT FALSE,
  needs_reminder BOOLEAN DEFAULT FALSE,
  needs_human_review BOOLEAN DEFAULT FALSE,
  routing_hints JSONB DEFAULT '{}'::jsonb,
  embedding JSONB,
  embedding_model TEXT,
  materialized_object_ids TEXT[] DEFAULT '{}',
  gemini_interaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_observations_key
  ON recording_observations (recording_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recording_observations_session
  ON recording_observations (session_id);

CREATE INDEX IF NOT EXISTS idx_recording_observations_canonical_key
  ON recording_observations (recording_key, canonical_key)
  WHERE canonical_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recording_observations_category
  ON recording_observations (recording_key, category);

ALTER TABLE recording_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY recording_observations_user_select ON recording_observations
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );
