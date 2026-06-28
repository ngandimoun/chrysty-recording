import { NextRequest, NextResponse } from "next/server";

import { getObservationsBySession, searchObservationsDb } from "@/lib/db/observations";
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

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const query = request.nextUrl.searchParams.get("q") ?? undefined;

    if (sessionId) {
      const observations = await getObservationsBySession(sessionId);
      return NextResponse.json({ observations });
    }

    const observations = await searchObservationsDb({
      recordingKey: identity.recordingKey,
      query,
      limit: 30,
    });
    return NextResponse.json({ observations });
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
