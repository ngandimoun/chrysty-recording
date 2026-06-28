import { aggregateInsights } from "@/lib/insights/aggregate";
import {
  getInsightsSnapshotMeta,
  getKnowledgeObjectRowsForRecordingKey,
  getSessionsForRecordingKey,
  listActiveRecommendations,
  upsertInsightsSnapshot,
} from "@/lib/db/queries";
import type { InsightsData } from "@/types";

import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import { isChrystyDocument } from "@/lib/presentation/schema/document";

async function attachRecommendations(
  recordingKey: string,
  data: InsightsData
): Promise<InsightsData> {
  const recommendations = await listActiveRecommendations(recordingKey);
  if (recommendations.length === 0) return data;
  return {
    ...data,
    recommendations: recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      presentationDocument: isChrystyDocument(r.presentationDocument)
        ? (r.presentationDocument as ChrystyDocument)
        : undefined,
      patternKey: r.patternKey,
      createdAt: r.createdAt,
    })),
  };
}

function isValidInsightsData(data: unknown): data is InsightsData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const arrayKeys = [
    "mostMentionedPeople",
    "topics",
    "projects",
    "locations",
    "objects",
    "timeAllocation",
    "moodOverTime",
    "knowledgeGrowth",
  ] as const;
  if (!arrayKeys.every((key) => Array.isArray(d[key]))) return false;
  if (typeof d.documentsGenerated !== "number") return false;

  const attentionStats = d.attentionStats;
  if (
    !attentionStats ||
    typeof attentionStats !== "object" ||
    typeof (attentionStats as Record<string, unknown>).created !== "number" ||
    typeof (attentionStats as Record<string, unknown>).completed !== "number" ||
    typeof (attentionStats as Record<string, unknown>).pending !== "number" ||
    typeof (attentionStats as Record<string, unknown>).period !== "string"
  ) {
    return false;
  }

  const speakingTrends = d.speakingTrends;
  if (
    !speakingTrends ||
    typeof speakingTrends !== "object" ||
    typeof (speakingTrends as Record<string, unknown>).avgDurationMinutes !== "number" ||
    typeof (speakingTrends as Record<string, unknown>).recordingsPerWeek !== "number" ||
    typeof (speakingTrends as Record<string, unknown>).peakHour !== "string" ||
    typeof (speakingTrends as Record<string, unknown>).mostProductiveDay !== "string" ||
    typeof (speakingTrends as Record<string, unknown>).mostActiveMonth !== "string"
  ) {
    return false;
  }

  return true;
}

export async function refreshInsightsSnapshot(recordingKey: string): Promise<InsightsData> {
  const [koRows, sessions] = await Promise.all([
    getKnowledgeObjectRowsForRecordingKey(recordingKey),
    getSessionsForRecordingKey(recordingKey),
  ]);
  const data = aggregateInsights(koRows, sessions);
  await upsertInsightsSnapshot(recordingKey, data);
  return await attachRecommendations(recordingKey, data);
}

const refreshInFlight = new Map<string, Promise<InsightsData>>();

function triggerBackgroundRefresh(recordingKey: string): void {
  if (refreshInFlight.has(recordingKey)) return;
  const promise = refreshInsightsSnapshot(recordingKey).finally(() => {
    refreshInFlight.delete(recordingKey);
  });
  refreshInFlight.set(recordingKey, promise);
  void promise;
}

export async function getInsightsForRecordingKey(
  recordingKey: string,
  options?: { refresh?: boolean }
): Promise<InsightsData & { stale?: boolean; refreshing?: boolean }> {
  if (options?.refresh) {
    return refreshInsightsSnapshot(recordingKey);
  }

  const meta = await getInsightsSnapshotMeta(recordingKey);

  if (!meta?.data || Object.keys(meta.data).length === 0 || !isValidInsightsData(meta.data)) {
    return refreshInsightsSnapshot(recordingKey);
  }

  const isStale =
    meta.staleAt &&
    (!meta.refreshedAt || new Date(meta.staleAt) > new Date(meta.refreshedAt));

  if (isStale) {
    triggerBackgroundRefresh(recordingKey);
    const withRecommendations = await attachRecommendations(recordingKey, meta.data);
    return { ...withRecommendations, stale: true, refreshing: true };
  }

  return await attachRecommendations(recordingKey, meta.data);
}
