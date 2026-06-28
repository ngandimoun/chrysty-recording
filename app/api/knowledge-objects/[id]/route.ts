import { NextRequest, NextResponse } from "next/server";

import {
  deleteKnowledgeObjectDb,
  getKnowledgeObjectDb,
  updateKnowledgeObjectDb,
} from "@/lib/db/queries";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";
import { withRepairedPresentation } from "@/lib/presentation/repair-knowledge-object";
import type { AttentionStatus } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const { id } = await params;
    const object = await getKnowledgeObjectDb(id, identity.recordingKey);
    if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const repairedObject = await withRepairedPresentation(object, identity.recordingKey);
    return NextResponse.json({ object: repairedObject });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const { id } = await params;
    const body = await request.json();
    const object = await updateKnowledgeObjectDb(identity.recordingKey, id, {
      title: body.title,
      subtitle: body.subtitle,
      previewContent: body.previewContent,
      status: body.status as AttentionStatus | undefined,
      dueAt: body.dueAt,
      relatedObjectIds: body.relatedObjectIds,
    });
    if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      const { refreshInsightsSnapshot } = await import("@/lib/insights/snapshot");
      await refreshInsightsSnapshot(identity.recordingKey);
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ object });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const { id } = await params;
    const deleted = await deleteKnowledgeObjectDb(identity.recordingKey, id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      const { refreshInsightsSnapshot } = await import("@/lib/insights/snapshot");
      await refreshInsightsSnapshot(identity.recordingKey);
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
