export const MAX_CONTEXT_FILES = 5;
export const MAX_CONTEXT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CONTEXT_MIME_PREFIXES = [
  "application/pdf",
  "text/",
  "image/",
  "audio/",
  "application/vnd.openxmlformats-officedocument",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument",
  "application/json",
  "application/rtf",
] as const;

export function isAllowedContextMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  return ALLOWED_CONTEXT_MIME_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix)
  );
}

export function generateAttachmentId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
