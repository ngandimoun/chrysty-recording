export const RECORDING_KEY_HEADER = "x-recording-key";
export const RECORDING_KEY_STORAGE = "chrysty_recording_key";

export function getUploadsBucketFromEnv(): string {
  return process.env.SUPABASE_UPLOADS_BUCKET?.trim() || "recording-uploads";
}
