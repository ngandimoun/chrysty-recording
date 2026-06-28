-- Forward migration: structured presentation documents
-- Remote name: recording_worker_presentation_document (apply after user approval)

ALTER TABLE knowledge_objects
  ADD COLUMN IF NOT EXISTS presentation_document JSONB;

ALTER TABLE knowledge_object_versions
  ADD COLUMN IF NOT EXISTS presentation_document JSONB;

ALTER TABLE recording_recommendations
  ADD COLUMN IF NOT EXISTS presentation_document JSONB;
