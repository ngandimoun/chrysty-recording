import { createUntypedAdminClient } from "@/lib/supabase/admin";

import { ensureRecordingWorkspace } from "./workspace";

function createRecordingKey(): string {
  return `rk_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function getDefaultRecordingKeyForUser(userId: string): Promise<string | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_workspaces")
    .select("recording_key")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { recording_key?: string } | null)?.recording_key ?? null;
}

export async function ensureDefaultRecordingKeyForUser(userId: string): Promise<string> {
  const existing = await getDefaultRecordingKeyForUser(userId);
  if (existing) return existing;

  const recordingKey = createRecordingKey();
  await ensureRecordingWorkspace(recordingKey, userId);
  return recordingKey;
}
