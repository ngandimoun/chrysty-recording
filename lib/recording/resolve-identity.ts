import { getRecordingKeyFromRequest } from "@/lib/recording/request";
import { getUserIdFromRequest } from "@/lib/supabase/server";

export interface RecordingIdentity {
  recordingKey: string;
  userId?: string;
}

export async function resolveIdentityFromRequest(
  request: Request
): Promise<RecordingIdentity | null> {
  const recordingKey = getRecordingKeyFromRequest(request);
  if (!recordingKey) return null;

  const userId = (await getUserIdFromRequest(request)) ?? undefined;
  return { recordingKey, userId };
}
