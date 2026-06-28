"use client";

import { formatDuration } from "@/lib/format";

interface RecordingTimerProps {
  seconds: number;
}

export function RecordingTimer({ seconds }: RecordingTimerProps) {
  return (
    <div
      className="font-mono text-5xl font-light tracking-wider text-foreground tabular-nums sm:text-6xl"
      aria-live="polite"
      aria-label={`Recording duration ${formatDuration(seconds)}`}
    >
      {formatDuration(seconds)}
    </div>
  );
}
