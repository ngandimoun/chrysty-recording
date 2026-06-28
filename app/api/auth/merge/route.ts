import { NextResponse } from "next/server";

import {
  assertAuthenticatedRequest,
  respondPlatformAccessError,
} from "@/lib/chrysty/guard";
import { mergeAnonymousRecordingWorkspace } from "@/lib/recording/merge-anonymous";
import { getRecordingKeyFromRequest } from "@/lib/recording/request";
import { getUserIdFromRequest } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    await assertAuthenticatedRequest(request);
  } catch (error) {
    const response = respondPlatformAccessError(error);
    if (response) return response;
    throw error;
  }

  const recordingKey = getRecordingKeyFromRequest(request);
  const userId = await getUserIdFromRequest(request);

  if (!recordingKey || !userId) {
    return NextResponse.json(
      { error: "Missing recording key or auth token" },
      { status: 400 }
    );
  }

  try {
    await mergeAnonymousRecordingWorkspace(recordingKey, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to merge workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
