import { NextRequest, NextResponse } from "next/server";

import { listSessionsForRecordingKey } from "@/lib/db/queries";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";

export async function GET(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;

    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const sessions = await listSessionsForRecordingKey(identity.recordingKey, {
      limit: 50,
      status: status as "uploading" | "processing" | "completed" | "failed" | undefined,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
