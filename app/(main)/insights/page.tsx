"use client";

import { useEffect, useState } from "react";
import { InsightsSection } from "@/components/insights/InsightsSection";
import { RankedList } from "@/components/insights/RankedList";
import {
  KnowledgeGrowthChart,
  MoodChart,
  TimeAllocationChart,
} from "@/components/insights/InsightCharts";
import { AttentionStatsCard, SpeakingTrendsCard } from "@/components/insights/StatCards";
import { VoiceHistoryPrompt } from "@/components/insights/VoiceHistoryPrompt";
import { RecommendationsPanel } from "@/components/insights/RecommendationsPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { fetchInsights } from "@/lib/data-client";
import type { InsightsData } from "@/types";

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="space-y-5 py-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What your voice history tells you
        </p>
      </div>

      <InsightsSection title="Ask your voice history" index={0}>
        <VoiceHistoryPrompt />
      </InsightsSection>

      {loading ? (
        <LoadingSkeleton className="h-64" />
      ) : error ? (
        <EmptyState title="Could not load insights" description={error} />
      ) : data ? (
        <>
          {data.recommendations && data.recommendations.length > 0 ? (
            <InsightsSection title="Suggestions" subtitle="Based on your voice history" index={1}>
              <RecommendationsPanel items={data.recommendations} />
            </InsightsSection>
          ) : null}

          <InsightsSection title="Knowledge Growth" subtitle="Observations, entities, and connections over time" index={2}>
            <KnowledgeGrowthChart data={data.knowledgeGrowth} />
          </InsightsSection>

          <InsightsSection title="Most Mentioned People" index={3}>
            <RankedList items={data.mostMentionedPeople} showTrend />
          </InsightsSection>

          <InsightsSection title="Topics" index={4}>
            <RankedList items={data.topics} />
          </InsightsSection>

          <InsightsSection title="Projects" index={5}>
            <RankedList items={data.projects} />
          </InsightsSection>

          <InsightsSection title="Locations" index={6}>
            <RankedList items={data.locations} />
          </InsightsSection>

          <InsightsSection title="Objects" index={7}>
            <RankedList items={data.objects} />
          </InsightsSection>

          <InsightsSection title="Time Allocation" index={8}>
            <TimeAllocationChart data={data.timeAllocation} />
          </InsightsSection>

          <InsightsSection
            title="Things Needing Attention"
            subtitle={data.attentionStats.period}
            index={9}
          >
            <AttentionStatsCard stats={data.attentionStats} />
          </InsightsSection>

          <InsightsSection title="Mood" subtitle="Sentiment over recent weeks" index={10}>
            <MoodChart data={data.moodOverTime} />
          </InsightsSection>

          <InsightsSection title="Recording Activity" index={11}>
            <SpeakingTrendsCard trends={data.speakingTrends} />
          </InsightsSection>

          <InsightsSection title="Documents Generated" index={12}>
            <p className="text-4xl font-semibold tabular-nums text-foreground">
              {data.documentsGenerated}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total documents created from recordings
            </p>
          </InsightsSection>
        </>
      ) : null}
    </main>
  );
}
