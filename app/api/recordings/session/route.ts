import { NextRequest, NextResponse } from "next/server";

import {
  deleteSession,
  getSessionForRecordingKey,
  getSessionSummary,
  resetSessionForRetry,
  updateSession,
} from "@/lib/db/queries";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";
import type { UseCaseCategory } from "@/types";

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

    const summary = await getSessionSummary(sessionId, identity.recordingKey);
    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(summary);
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;

    const body = await request.json();
    const sessionId = body.sessionId as string | undefined;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getSessionForRecordingKey(identity.recordingKey, sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "retry") {
      await resetSessionForRetry(identity.recordingKey, sessionId);
      return NextResponse.json({ success: true, status: "uploading" });
    }

    if (body.useCase) {
      await updateSession(sessionId, { use_case: body.useCase as UseCaseCategory });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
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
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    await deleteSession(identity.recordingKey, sessionId);

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
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
