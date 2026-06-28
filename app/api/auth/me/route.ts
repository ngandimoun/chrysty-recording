import { auth } from "@chrysty/platform";
import { NextResponse, type NextRequest } from "next/server";

import { configurePlatformForToken } from "@/lib/chrysty/platform";
import { ensureDefaultRecordingKeyForUser } from "@/lib/recording/user-workspace";
import { getServerSession } from "@/lib/chrysty/server-session";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);

  if (!session?.access_token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  configurePlatformForToken(session.access_token);

  try {
    const user = await auth.getUser();
    const recordingKey = isSupabaseConfigured()
      ? await ensureDefaultRecordingKeyForUser(user.id)
      : null;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      recordingKey,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}
