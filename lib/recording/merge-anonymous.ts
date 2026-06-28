import { linkRecordingWorkspaceToUser } from "@/lib/recording/workspace";

export async function mergeAnonymousRecordingWorkspace(
  recordingKey: string,
  userId: string
): Promise<void> {
  await linkRecordingWorkspaceToUser(recordingKey, userId);
}
