import { NextRequest, NextResponse } from "next/server";

import { createSession, insertAttachments } from "@/lib/db/queries";
import {
  generateAttachmentId,
  isAllowedContextMimeType,
  MAX_CONTEXT_FILE_BYTES,
  MAX_CONTEXT_FILES,
} from "@/lib/context/constants";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import {
  isAllowedAudioMime,
  isStorageMimeRejectionError,
  MIN_AUDIO_BYTES,
  resolveAudioExtension,
} from "@/lib/recording/audio-format";
import {
  requireAuthenticatedRecordingIdentity,
} from "@/lib/recording/guard";
import { ensureRecordingWorkspace } from "@/lib/recording/workspace";
import { isValidTimezone } from "@/lib/locale";
import { createAdminClient, getUploadsBucket, isSupabaseConfigured } from "@/lib/supabase/admin";
function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "context";
}

function uploadErrorStatus(message: string): number {
  return isStorageMimeRejectionError(message) ? 400 : 500;
}

function logUploadFailure(
  sessionId: string,
  details: {
    normalizedAudioMime: string;
    ext: string;
    byteLength: number;
    storagePath: string;
    message: string;
  }
) {
  console.error("[recordings/upload] storage upload failed", {
    sessionId,
    ...details,
  });
}

function sanitizeTimezone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || !tz.trim()) return undefined;
  const trimmed = tz.trim();
  if (trimmed.length > 64) return undefined;
  if (!isValidTimezone(trimmed)) return undefined;
  return trimmed;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    await requirePlatformAccess(request);
  } catch (error) {
    if (error instanceof PlatformAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request);
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const workspace = await ensureRecordingWorkspace(identity.recordingKey, identity.userId);
    const formData = await request.formData();
    const audio = formData.get("audio");
    const sessionId = formData.get("sessionId");
    const durationSeconds = formData.get("durationSeconds");
    const clientTimezone = sanitizeTimezone(formData.get("clientTimezone"));
    const recorderMimeType =
      typeof formData.get("recorderMimeType") === "string"
        ? formData.get("recorderMimeType")
        : undefined;
    const contextFiles = formData.getAll("context");

    if (!(audio instanceof Blob) || typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "Missing audio or sessionId" }, { status: 400 });
    }

    const audioMime =
      (typeof recorderMimeType === "string" && recorderMimeType) ||
      audio.type ||
      "audio/webm";
    const normalizedAudioMime = audioMime.split(";")[0].trim();

    if (!isAllowedAudioMime(normalizedAudioMime)) {
      return NextResponse.json({ error: "Unsupported audio format" }, { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    if (buffer.byteLength < MIN_AUDIO_BYTES) {
      return NextResponse.json({ error: "Recording is too short or empty" }, { status: 400 });
    }

    const blobs = contextFiles.filter((f): f is File => f instanceof Blob);

    if (blobs.length > MAX_CONTEXT_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONTEXT_FILES} context items allowed` },
        { status: 400 }
      );
    }

    for (const file of blobs) {
      if (file.size > MAX_CONTEXT_FILE_BYTES) {
        return NextResponse.json(
          { error: "Each context item must be 10 MB or smaller" },
          { status: 400 }
        );
      }
      const mimeType = file.type || "application/octet-stream";
      if (!isAllowedContextMimeType(mimeType)) {
        return NextResponse.json(
          { error: "One or more context items use an unsupported file type" },
          { status: 400 }
        );
      }
    }

    const ext = resolveAudioExtension(normalizedAudioMime);
    const bucket = getUploadsBucket();
    const storagePath = `${identity.recordingKey}/${sessionId}/audio.${ext}`;

    const { error: uploadError } = await createAdminClient()
      .storage.from(bucket)
      .upload(storagePath, buffer, {
        contentType: normalizedAudioMime,
        upsert: true,
      });

    if (uploadError) {
      logUploadFailure(sessionId, {
        normalizedAudioMime,
        ext,
        byteLength: buffer.byteLength,
        storagePath,
        message: uploadError.message,
      });
      return NextResponse.json(
        { error: uploadError.message },
        { status: uploadErrorStatus(uploadError.message) }
      );
    }

    await createSession({
      id: sessionId,
      audioPath: storagePath,
      durationSeconds:
        typeof durationSeconds === "string" ? parseInt(durationSeconds, 10) : undefined,
      workspaceId: workspace.id,
      userId: identity.userId,
      recordingKey: identity.recordingKey,
      clientTimezone,
      recorderMimeType: normalizedAudioMime,
    });

    const attachmentRecords: Array<{
      id: string;
      sessionId: string;
      fileName: string;
      mimeType: string;
      storagePath: string;
      sortOrder: number;
    }> = [];

    for (let i = 0; i < blobs.length; i++) {
      const file = blobs[i];
      const attachmentId = generateAttachmentId();
      const fileName = sanitizeFileName(
        file.name && file.name.length > 0 ? file.name : `context-${i + 1}`
      );
      const mimeType = file.type || "application/octet-stream";
      const contextPath = `${identity.recordingKey}/${sessionId}/context/${attachmentId}`;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error: contextError } = await createAdminClient()
        .storage.from(bucket)
        .upload(contextPath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (contextError) {
        console.error("[recordings/upload] context upload failed", {
          sessionId,
          contextPath,
          mimeType,
          message: contextError.message,
        });
        return NextResponse.json(
          { error: contextError.message },
          { status: uploadErrorStatus(contextError.message) }
        );
      }

      attachmentRecords.push({
        id: attachmentId,
        sessionId,
        fileName,
        mimeType,
        storagePath: contextPath,
        sortOrder: i,
      });
    }

    if (attachmentRecords.length > 0) {
      await insertAttachments(attachmentRecords);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      storagePath,
      attachmentCount: attachmentRecords.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
