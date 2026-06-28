-- Forward migration: RLS on knowledge update + enrichment tables
-- Remote name: recording_worker_knowledge_rls

ALTER TABLE knowledge_object_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_file_search_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_memory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_recommendations ENABLE ROW LEVEL SECURITY;

-- Scoped by recording_key workspace ownership
CREATE POLICY recording_key_user_select ON recording_knowledge_edges
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recording_key_user_select ON recording_changes
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recording_key_user_select ON recording_file_search_stores
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recording_key_user_select ON recording_memory_documents
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recording_key_user_select ON recording_recommendations
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recording_enrichment_jobs_user_select ON recording_enrichment_jobs
  FOR SELECT TO authenticated
  USING (
    recording_key IN (
      SELECT recording_key FROM recording_workspaces WHERE user_id = auth.uid()
    )
  );

-- Document versions via knowledge object session ownership
CREATE POLICY knowledge_object_versions_user_select ON knowledge_object_versions
  FOR SELECT TO authenticated
  USING (
    object_id IN (
      SELECT ko.id FROM knowledge_objects ko
      JOIN recording_sessions rs ON rs.id = ko.source_recording_id
      WHERE rs.user_id = auth.uid()
         OR rs.workspace_id IN (
           SELECT id FROM recording_workspaces WHERE user_id = auth.uid()
         )
    )
  );
