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

export function resolveAudioExtension(mime: string, filename?: string): string {
  const fromName = filename ? extensionFromFilename(filename) : null;
  if (fromName && ["webm", "m4a", "mp4", "ogg", "wav", "mp3", "aac"].includes(fromName)) {
    return fromName === "mp4" ? "m4a" : fromName;
  }
  return extensionForMime(mime);
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
  return !["mp3", "wav", "ogg", "m4a", "aac"].includes(ext);
}
