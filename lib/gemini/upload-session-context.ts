import { downloadSessionFile, uploadBufferToGemini } from "@/lib/gemini/upload-gemini-file";
import {
  getAttachmentsBySession,
  updateAttachmentGeminiUri,
} from "@/lib/db/queries";
import type { SessionAttachment } from "@/lib/db/types";

export interface GeminiContextPart {
  type: "audio" | "image" | "file";
  uri: string;
  mime_type: string;
  fileName: string;
}

function mimeToGeminiPartType(mimeType: string): "audio" | "image" | "file" {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("image/")) return "image";
  return "file";
}

export async function uploadAttachmentToGemini(
  attachment: SessionAttachment
): Promise<GeminiContextPart | null> {
  try {
    const buffer = await downloadSessionFile(attachment.storagePath);
    const file = await uploadBufferToGemini(
      buffer,
      attachment.mimeType,
      attachment.fileName
    );
    if (!file.uri || !file.mimeType) {
      throw new Error("Gemini file missing uri");
    }

    await updateAttachmentGeminiUri(attachment.id, { geminiFileUri: file.uri });

    return {
      type: mimeToGeminiPartType(file.mimeType),
      uri: file.uri,
      mime_type: file.mimeType,
      fileName: attachment.fileName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    await updateAttachmentGeminiUri(attachment.id, { errorMessage: message }).catch(() => {});
    return null;
  }
}

export async function uploadAttachmentsForSession(
  sessionId: string
): Promise<GeminiContextPart[]> {
  const attachments = await getAttachmentsBySession(sessionId);
  const parts: GeminiContextPart[] = [];

  for (const attachment of attachments) {
    const part = await uploadAttachmentToGemini(attachment);
    if (part) parts.push(part);
  }

  return parts;
}

export function buildGeminiInputParts(parts: GeminiContextPart[]) {
  return parts.map((part) => ({
    type: part.type,
    uri: part.uri,
    mime_type: part.mime_type,
  }));
}

export function formatAttachmentNames(parts: GeminiContextPart[]): string {
  if (parts.length === 0) return "";
  return parts.map((p) => p.fileName).join(", ");
}
