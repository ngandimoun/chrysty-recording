import { NextRequest, NextResponse } from "next/server";

import {
  getKnowledgeObjectDb,
  getObjectsBySession,
  getRecentActivity,
  getRelatedObjects,
  getTimelineGroups,
  getTodayAttentionItems,
  searchKnowledgeObjectsDb,
} from "@/lib/db/queries";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";
import { withRepairedPresentation, repairKnowledgeObjects } from "@/lib/presentation/repair-knowledge-object";

export async function GET(request: NextRequest) {
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    const identity = identityOrResponse;
    const { searchParams } = request.nextUrl;
    const view = searchParams.get("view");
    const id = searchParams.get("id");
    const sessionId = searchParams.get("sessionId");
    const relatedTo = searchParams.get("relatedTo");
    const q = searchParams.get("q");

    if (id) {
      const object = await getKnowledgeObjectDb(id, identity.recordingKey);
      if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const repairedObject = await withRepairedPresentation(object, identity.recordingKey);
      return NextResponse.json({ object: repairedObject });
    }

    if (relatedTo) {
      const objects = await getRelatedObjects(identity.recordingKey, relatedTo);
      const repairedObjects = await repairKnowledgeObjects(objects, identity.recordingKey);
      return NextResponse.json({ objects: repairedObjects });
    }

    if (sessionId) {
      const objects = await getObjectsBySession(sessionId, identity.recordingKey);
      const repairedObjects = await repairKnowledgeObjects(objects, identity.recordingKey);
      return NextResponse.json({ objects: repairedObjects });
    }

    if (q) {
      const objects = await searchKnowledgeObjectsDb({
        recordingKey: identity.recordingKey,
        query: q,
      });
      const repairedObjects = await repairKnowledgeObjects(objects, identity.recordingKey);
      return NextResponse.json({ objects: repairedObjects });
    }

    switch (view) {
      case "home":
        return NextResponse.json({
          todayItems: await getTodayAttentionItems(identity.recordingKey),
          recentActivity: await getRecentActivity(identity.recordingKey),
        });
      case "timeline":
        return NextResponse.json({
          groups: await getTimelineGroups(identity.recordingKey),
        });
      default:
        return NextResponse.json({
          objects: await repairKnowledgeObjects(
            await searchKnowledgeObjectsDb({ recordingKey: identity.recordingKey }),
            identity.recordingKey
          ),
        });
    }
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
