import { NextRequest, NextResponse } from "next/server";

import {
  requireAuthenticatedRecordingIdentity,
  getErrorMessage,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";

export async function GET(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request);
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;

    const { getInsightsForRecordingKey } = await import("@/lib/insights/snapshot");
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const data = await getInsightsForRecordingKey(identity.recordingKey, { refresh });

    return NextResponse.json(data);
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
