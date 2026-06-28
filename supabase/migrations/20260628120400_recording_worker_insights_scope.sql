-- Forward migration: scope insights and voice Q&A threads per recording key

ALTER TABLE voice_history_threads ADD COLUMN IF NOT EXISTS recording_key text;

CREATE UNIQUE INDEX IF NOT EXISTS voice_history_threads_recording_key_unique
  ON voice_history_threads(recording_key) WHERE recording_key IS NOT NULL;

ALTER TABLE insights_snapshots ADD COLUMN IF NOT EXISTS recording_key text;

CREATE UNIQUE INDEX IF NOT EXISTS insights_snapshots_recording_key_unique
  ON insights_snapshots(recording_key) WHERE recording_key IS NOT NULL;
