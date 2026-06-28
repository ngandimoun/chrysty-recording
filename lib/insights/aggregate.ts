import type {
  AttentionStats,
  InsightsData,
  KnowledgeGrowthPoint,
  MoodDataPoint,
  RankedItem,
  SpeakingTrends,
  TimeAllocationSlice,
} from "@/types";
import type { KnowledgeObjectRow, RecordingSessionRow } from "@/lib/db/types";

function groupRanked(
  rows: KnowledgeObjectRow[],
  type: string,
  limit = 8
): RankedItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== type) continue;
    const key = row.title.trim();
    counts.set(key, (counts.get(key) ?? 0) + (row.mention_count ?? 1));
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count], i) => ({
      id: `${type}-${i}`,
      label,
      count,
      trend: "stable" as const,
    }));
}

function buildKnowledgeGrowth(rows: KnowledgeObjectRow[]): KnowledgeGrowthPoint[] {
  const byMonth = new Map<string, { entities: number; connections: number }>();
  for (const row of rows) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { entities: 0, connections: 0 };
    entry.entities += 1;
    const related = row.related_object_ids;
    if (Array.isArray(related)) entry.connections += related.length;
    byMonth.set(key, entry);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([date, v]) => ({ date, ...v }));
}

function buildMoodOverTime(sessions: RecordingSessionRow[]): MoodDataPoint[] {
  const byWeek = new Map<string, { positive: number; neutral: number; negative: number }>();
  for (const session of sessions) {
    const detail = session.transcript_detail as {
      segments?: Array<{ emotion?: string }>;
    } | null;
    const segments = detail?.segments ?? [];
    if (segments.length === 0) continue;
    const d = new Date(session.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const bucket = byWeek.get(key) ?? { positive: 0, neutral: 0, negative: 0 };
    for (const seg of segments) {
      const e = seg.emotion ?? "neutral";
      if (e === "happy") bucket.positive += 1;
      else if (e === "sad" || e === "angry") bucket.negative += 1;
      else bucket.neutral += 1;
    }
    byWeek.set(key, bucket);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, counts]) => {
      const total = counts.positive + counts.neutral + counts.negative || 1;
      return {
        date,
        positive: Math.round((counts.positive / total) * 100),
        neutral: Math.round((counts.neutral / total) * 100),
        negative: Math.round((counts.negative / total) * 100),
      };
    });
}

function buildSpeakingTrends(sessions: RecordingSessionRow[]): SpeakingTrends {
  const completed = sessions.filter((s) => s.duration_seconds != null);
  const avgDurationMinutes =
    completed.length > 0
      ? completed.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) /
        completed.length /
        60
      : 0;

  const now = Date.now();
  const weekMs = 7 * 86400000;
  const recent = sessions.filter((s) => now - new Date(s.created_at).getTime() < 4 * weekMs);
  const recordingsPerWeek = recent.length / 4;

  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const monthCounts = new Map<string, number>();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const s of sessions) {
    const d = new Date(s.created_at);
    hourCounts[d.getHours()] += 1;
    dayCounts[d.getDay()] += 1;
    const monthKey = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
  }

  const peakHourIdx = hourCounts.indexOf(Math.max(...hourCounts));
  const peakDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  const mostActiveMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    avgDurationMinutes: Math.round(avgDurationMinutes * 10) / 10,
    recordingsPerWeek: Math.round(recordingsPerWeek * 10) / 10,
    peakHour: `${peakHourIdx === 0 ? 12 : peakHourIdx > 12 ? peakHourIdx - 12 : peakHourIdx}:00 ${peakHourIdx >= 12 ? "PM" : "AM"}`,
    mostProductiveDay: days[peakDayIdx] ?? "—",
    mostActiveMonth,
  };
}

function buildTimeAllocation(rows: KnowledgeObjectRow[]): TimeAllocationSlice[] {
  const typeCounts: Record<string, number> = {};
  for (const row of rows) {
    typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1;
  }
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1;
  const buckets: Record<string, number> = {
    Meetings: (typeCounts.person ?? 0) + (typeCounts.event ?? 0),
    Ideas: typeCounts.idea ?? 0,
    Documents: typeCounts.document ?? 0,
    Tasks: typeCounts.attention ?? 0,
    Other:
      (typeCounts.place ?? 0) +
      (typeCounts.company ?? 0) +
      (typeCounts.object ?? 0),
  };
  return Object.entries(buckets)
    .filter(([, c]) => c > 0)
    .map(([label, count]) => ({
      label,
      percentage: Math.round((count / total) * 100),
    }));
}

function buildAttentionStats(rows: KnowledgeObjectRow[]): AttentionStats {
  const attention = rows.filter((r) => r.type === "attention");
  return {
    created: attention.length,
    completed: attention.filter((r) => r.status === "completed").length,
    pending: attention.filter((r) =>
      ["pending", "due", "waiting"].includes(r.status ?? "")
    ).length,
    period: "Last 30 days",
  };
}

export function aggregateInsights(
  koRows: KnowledgeObjectRow[],
  sessions: RecordingSessionRow[]
): InsightsData {
  return {
    mostMentionedPeople: groupRanked(koRows, "person"),
    topics: groupRanked(koRows, "idea"),
    projects: groupRanked(koRows, "event"),
    locations: groupRanked(koRows, "place"),
    objects: groupRanked(koRows, "object"),
    timeAllocation: buildTimeAllocation(koRows),
    attentionStats: buildAttentionStats(koRows),
    moodOverTime: buildMoodOverTime(sessions),
    speakingTrends: buildSpeakingTrends(sessions),
    knowledgeGrowth: buildKnowledgeGrowth(koRows),
    documentsGenerated: koRows.filter((r) => r.type === "document").length,
  };
}
