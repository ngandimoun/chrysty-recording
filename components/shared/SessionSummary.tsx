"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatSessionSummaryLine } from "@/lib/format-session";

export interface SessionSummaryData {
  durationSeconds: number | null;
  attachmentCount: number;
  attachmentNames: string[];
}

interface SessionSummaryProps {
  summary: SessionSummaryData;
  className?: string;
}

export function SessionSummary({ summary, className }: SessionSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const line = formatSessionSummaryLine(summary.durationSeconds, summary.attachmentCount);
  const canExpand = summary.attachmentNames.length > 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">{line}</p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide context items" : "Show context items"}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>
      {expanded && summary.attachmentNames.length > 0 && (
        <ul className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
          {summary.attachmentNames.map((name) => (
            <li key={name} className="truncate">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
