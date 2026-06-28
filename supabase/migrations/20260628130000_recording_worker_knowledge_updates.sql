-- Forward migration: update-first knowledge + async enrichment
-- Remote name: recording_worker_knowledge_updates (apply after user approval)

-- Extend knowledge_objects for entity resolution and versioning
ALTER TABLE knowledge_objects
  ADD COLUMN IF NOT EXISTS canonical_key TEXT,
  ADD COLUMN IF NOT EXISTS active_version_id TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_knowledge_objects_canonical_key
  ON knowledge_objects (canonical_key)
  WHERE canonical_key IS NOT NULL;

-- Document / artifact version history
CREATE TABLE IF NOT EXISTS knowledge_object_versions (
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL REFERENCES knowledge_objects(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  source_recording_id TEXT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  gemini_interaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (object_id, version_number)
);

-- Typed knowledge graph edges
CREATE TABLE IF NOT EXISTS recording_knowledge_edges (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL,
  from_object_id TEXT NOT NULL REFERENCES knowledge_objects(id) ON DELETE CASCADE,
  to_object_id TEXT NOT NULL REFERENCES knowledge_objects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  source_recording_id TEXT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_knowledge_edges_key
  ON recording_knowledge_edges (recording_key);

-- Change log ("what changed")
CREATE TABLE IF NOT EXISTS recording_changes (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL,
  object_id TEXT REFERENCES knowledge_objects(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL DEFAULT 'update',
  source_recording_id TEXT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_changes_key
  ON recording_changes (recording_key, created_at DESC);

-- Background enrichment job queue
CREATE TABLE IF NOT EXISTS recording_enrichment_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  recording_key TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recording_enrichment_jobs_pending
  ON recording_enrichment_jobs (status, created_at)
  WHERE status = 'pending';

-- Gemini File Search store mapping
CREATE TABLE IF NOT EXISTS recording_file_search_stores (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL UNIQUE,
  gemini_store_name TEXT NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'models/gemini-embedding-2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recording_memory_documents (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  gemini_document_name TEXT,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recording_key, source_type, source_id)
);

-- Proactive recommendations (background)
CREATE TABLE IF NOT EXISTS recording_recommendations (
  id TEXT PRIMARY KEY,
  recording_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pattern_key TEXT,
  source_recording_id TEXT REFERENCES recording_sessions(id) ON DELETE SET NULL,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session pipeline state + enrichment tracking
ALTER TABLE recording_sessions
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pipeline_state JSONB DEFAULT '{}'::jsonb;

-- Lazy insights refresh
ALTER TABLE insights_snapshots
  ADD COLUMN IF NOT EXISTS stale_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refreshed_at TIMESTAMPTZ;
