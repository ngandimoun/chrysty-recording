"use client";

import type { AttentionStats, SpeakingTrends } from "@/types";

export function AttentionStatsCard({ stats }: { stats: AttentionStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Created", value: stats.created },
        { label: "Completed", value: stats.completed },
        { label: "Pending", value: stats.pending },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-2xl bg-muted/50 px-3 py-4 text-center"
        >
          <p className="text-2xl font-semibold tabular-nums text-foreground">{item.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function SpeakingTrendsCard({ trends }: { trends: SpeakingTrends }) {
  const items = [
    { label: "Avg duration", value: `${trends.avgDurationMinutes} min` },
    { label: "Per week", value: `${trends.recordingsPerWeek}` },
    { label: "Peak hour", value: trends.peakHour },
    { label: "Best day", value: trends.mostProductiveDay },
    { label: "Active month", value: trends.mostActiveMonth },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-muted/50 px-3 py-3">
          <p className="text-sm font-medium text-foreground">{item.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
