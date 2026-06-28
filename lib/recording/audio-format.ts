const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/aac",
]);

export const MIN_AUDIO_BYTES = 1024;

export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    case "audio/aac":
      return "aac";
    case "audio/webm":
    default:
      return "webm";
  }
}

export function extensionFromFilename(name: string): string | null {
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : null;
}

export function resolveAudioExtension(mime: string): string {
  return extensionForMime(mime);
}

const LIKELY_AUDIO_EXTENSIONS = new Set([
  "m4a",
  "mp4",
  "aac",
  "caf",
  "mp3",
  "wav",
  "ogg",
  "webm",
]);

export function isLikelyAudioFile(mimeType: string, fileName?: string): boolean {
  const base = mimeType.toLowerCase().split(";")[0].trim();
  if (base.startsWith("audio/")) return true;
  const fromName = fileName ? extensionFromFilename(fileName) : null;
  return fromName !== null && LIKELY_AUDIO_EXTENSIONS.has(fromName);
}

export function isAllowedAudioMime(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  return ALLOWED_AUDIO_MIMES.has(base);
}

export function geminiMimeForExtension(ext: string): string {
  switch (ext) {
    case "mp3":
      return "audio/mp3";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/aac";
    case "webm":
    default:
      return "audio/mp3";
  }
}

export function needsAudioTranscode(ext: string): boolean {
  return !["mp3", "wav", "ogg"].includes(ext);
}

export function needsAudioTranscodeForMime(mime: string): boolean {
  const ext = extensionForMime(mime);
  return needsAudioTranscode(ext);
}
