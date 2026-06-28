import { RECORDING_KEY_HEADER } from "@/lib/recording/constants";

export function getRecordingKeyFromRequest(request: Request): string | null {
  const key = request.headers.get(RECORDING_KEY_HEADER)?.trim();
  if (!key || key.length < 8) {
    return null;
  }
  return key;
}
