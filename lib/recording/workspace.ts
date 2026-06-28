import { WORKER_SLUG } from "@/lib/chrysty/constants";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase/admin";
import type {
  RecordingWorkspaceInsert,
  RecordingWorkspaceRow,
} from "@/lib/supabase/recording-schema.types";

export type { RecordingWorkspaceRow };

function createVisitorToken(): string {
  return `vis_${crypto.randomUUID().replace(/-/g, "")}`;
}

function isInsertConflict(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function findPlatformWorkspaceId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("worker_workspaces")
    .select("id")
    .eq("user_id", userId)
    .eq("worker_slug", WORKER_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function findWorkspaceByRecordingKey(
  recordingKey: string
): Promise<RecordingWorkspaceRow | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_workspaces")
    .select("*")
    .eq("recording_key", recordingKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RecordingWorkspaceRow | null;
}

export async function linkRecordingWorkspaceToUser(
  recordingKey: string,
  userId: string
): Promise<void> {
  const platformWorkspaceId = await findPlatformWorkspaceId(userId);

  const update: Partial<RecordingWorkspaceInsert> = {
    user_id: userId,
  };

  if (platformWorkspaceId) {
    update.platform_workspace_id = platformWorkspaceId;
  }

  await createUntypedAdminClient()
    .from("recording_workspaces")
    .update(update)
    .eq("recording_key", recordingKey)
    .is("user_id", null);

  const workspace = await findWorkspaceByRecordingKey(recordingKey);
  if (!workspace) return;

  await createUntypedAdminClient()
    .from("recording_sessions")
    .update({
      user_id: userId,
      workspace_id: workspace.id,
    })
    .eq("recording_key", recordingKey)
    .is("user_id", null);
}

export async function ensureRecordingWorkspace(
  recordingKey: string,
  userId?: string
): Promise<RecordingWorkspaceRow> {
  const existing = await findWorkspaceByRecordingKey(recordingKey);
  if (existing) {
    if (userId && !existing.user_id) {
      await linkRecordingWorkspaceToUser(recordingKey, userId);
      const linked = await findWorkspaceByRecordingKey(recordingKey);
      if (linked) return linked;
    }
    return existing;
  }

  const platformWorkspaceId = userId ? await findPlatformWorkspaceId(userId) : null;

  const insert: RecordingWorkspaceInsert = {
    recording_key: recordingKey,
    visitor_token: createVisitorToken(),
    name: "My Sessions",
    is_default: true,
    user_id: userId ?? null,
    platform_workspace_id: platformWorkspaceId,
  };

  const { data: created, error: insertError } = await createUntypedAdminClient()
    .from("recording_workspaces")
    .insert(insert)
    .select("*")
    .single();

  if (insertError) {
    if (isInsertConflict(insertError)) {
      const retry = await findWorkspaceByRecordingKey(recordingKey);
      if (retry) return retry;
    }
    throw new Error(insertError.message);
  }

  return created as RecordingWorkspaceRow;
}

export async function getWorkspaceForRecordingKey(recordingKey: string) {
  return findWorkspaceByRecordingKey(recordingKey);
}
