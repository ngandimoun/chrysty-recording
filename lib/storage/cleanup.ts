import { createAdminClient, getUploadsBucket } from "@/lib/supabase/admin";

export async function deleteStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const bucket = getUploadsBucket();
  const { error } = await createAdminClient().storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);
}

export async function deleteSessionStorage(
  recordingKey: string,
  sessionId: string,
  attachmentPaths: string[] = [],
  audioPath?: string | null
): Promise<void> {
  const paths = [
    audioPath ?? `${recordingKey}/${sessionId}/audio.webm`,
    ...attachmentPaths,
  ];
  await deleteStoragePaths(paths);
}
