import { getRecordingKeyFromRequest } from "@/lib/recording/request";
import { getDefaultRecordingKeyForUser } from "@/lib/recording/user-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { getUserIdFromRequest } from "@/lib/supabase/server";

export interface RecordingIdentity {
  recordingKey: string;
  userId?: string;
}

export async function resolveIdentityFromRequest(
  request: Request
): Promise<RecordingIdentity | null> {
  const userId = (await getUserIdFromRequest(request)) ?? undefined;

  if (userId && isSupabaseConfigured()) {
    const defaultKey = await getDefaultRecordingKeyForUser(userId);
    if (defaultKey) {
      return { recordingKey: defaultKey, userId };
    }
  }

  const recordingKey = getRecordingKeyFromRequest(request);
  if (!recordingKey) return null;

  return { recordingKey, userId };
}
