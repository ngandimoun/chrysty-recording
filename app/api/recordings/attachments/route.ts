import { NextRequest, NextResponse } from "next/server";

import {
  generateAttachmentId,
  isAllowedContextMimeType,
  MAX_CONTEXT_FILE_BYTES,
  MAX_CONTEXT_FILES,
} from "@/lib/context/constants";
import { getAttachmentsBySession, insertSingleAttachment } from "@/lib/db/queries";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";
import { createAdminClient, getUploadsBucket, isSupabaseConfigured } from "@/lib/supabase/admin";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "context";
}

export async function GET(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const { getSessionForRecordingKey } = await import("@/lib/db/queries");
    const session = await getSessionForRecordingKey(identity.recordingKey, sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const attachments = await getAttachmentsBySession(sessionId);
    return NextResponse.json({ attachments });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request);
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const file = formData.get("file");

    if (typeof sessionId !== "string" || !(file instanceof Blob)) {
      return NextResponse.json({ error: "sessionId and file required" }, { status: 400 });
    }

    const { getSessionForRecordingKey } = await import("@/lib/db/queries");
    const session = await getSessionForRecordingKey(identity.recordingKey, sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (session.status === "processing") {
      return NextResponse.json(
        { error: "Cannot add files while processing" },
        { status: 409 }
      );
    }

    const existing = await getAttachmentsBySession(sessionId);
    if (existing.length >= MAX_CONTEXT_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONTEXT_FILES} context items allowed` },
        { status: 400 }
      );
    }

    if (file.size > MAX_CONTEXT_FILE_BYTES) {
      return NextResponse.json(
        { error: "Each context item must be 10 MB or smaller" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedContextMimeType(mimeType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const attachmentId = generateAttachmentId();
    const fileName = sanitizeFileName(
      file instanceof File && file.name ? file.name : `context-${existing.length + 1}`
    );
    const contextPath = `${identity.recordingKey}/${sessionId}/context/${attachmentId}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await createAdminClient()
      .storage.from(getUploadsBucket())
      .upload(contextPath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const attachment = await insertSingleAttachment({
      id: attachmentId,
      sessionId,
      fileName,
      mimeType,
      storagePath: contextPath,
      sortOrder: existing.length,
    });

    return NextResponse.json({ attachment });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const attachmentId = request.nextUrl.searchParams.get("attachmentId");
    if (!sessionId || !attachmentId) {
      return NextResponse.json(
        { error: "sessionId and attachmentId required" },
        { status: 400 }
      );
    }

    const { deleteAttachmentDb } = await import("@/lib/db/queries");
    const deleted = await deleteAttachmentDb(identity.recordingKey, sessionId, attachmentId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
