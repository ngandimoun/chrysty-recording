import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import { configurePlatformForToken } from "@/lib/chrysty/platform";
import { getSessionForRecordingKey, getProcessingStatusPayload, updateSession } from "@/lib/db/queries";
import { runSessionProcessing } from "@/lib/processing/run-session";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";

export const runtime = "nodejs";
export const maxDuration = 300;

async function assertSessionAccess(request: NextRequest, sessionId: string) {
  const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
    ensureWorkspace: false,
  });
  if (identityOrResponse instanceof NextResponse) {
    throw new Error("Unauthorized");
  }
  const identity = identityOrResponse;
  const session = await getSessionForRecordingKey(identity.recordingKey, sessionId);
  if (!session) return null;
  return session;
}

export async function POST(request: NextRequest) {
  let sessionId: string | undefined;
  let accessToken: string | undefined;

  try {
    const authResult = await requirePlatformAccess(request);
    accessToken = authResult.session.access_token;
  } catch (error) {
    if (error instanceof PlatformAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    throw error;
  }

  try {
    const body = await request.json();
    sessionId = body.sessionId as string | undefined;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await assertSessionAccess(request, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status === "completed") {
      const payload = await getProcessingStatusPayload(session);
      return NextResponse.json({ success: true, ...payload });
    }

    if (session.status === "processing") {
      const payload = await getProcessingStatusPayload(session);
      return NextResponse.json({ success: true, ...payload }, { status: 202 });
    }

    await updateSession(sessionId, {
      status: "processing",
      processing_step: 0,
      error_message: null,
    });

    const id = sessionId;
    const token = accessToken;

    after(async () => {
      if (token) {
        configurePlatformForToken(token);
      }
      await runSessionProcessing(id);
    });

    return NextResponse.json(
      {
        success: true,
        status: "processing",
        processingStep: 0,
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    if (sessionId) {
      await updateSession(sessionId, { status: "failed", error_message: message }).catch(
        () => {}
      );
    }
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    throw error;
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const session = await assertSessionAccess(request, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = await getProcessingStatusPayload(session);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
