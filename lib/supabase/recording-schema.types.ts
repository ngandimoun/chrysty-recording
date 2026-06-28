/** Recording worker tables — included after forward migrations are applied. */

export interface RecordingWorkspaceRow {
  id: string;
  user_id: string | null;
  platform_workspace_id: string | null;
  name: string;
  visitor_token: string;
  recording_key: string;
  settings: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type RecordingWorkspaceInsert = Omit<RecordingWorkspaceRow, "id" | "created_at" | "updated_at" | "visitor_token" | "settings"> & {
  id?: string;
  visitor_token?: string;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};
