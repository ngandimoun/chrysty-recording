"use client";

import { Fragment } from "react";

type HighlightKind = "date" | "money" | "number" | "person" | "deadline";

const PATTERNS: Array<{ kind: HighlightKind; regex: RegExp }> = [
  {
    kind: "money",
    regex: /(\$[\d,]+(?:\.\d{2})?|\d[\d,]*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD))/g,
  },
  {
    kind: "date",
    regex:
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:,?\s+\d{4})?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  },
  {
    kind: "deadline",
    regex: /\b(?:due|deadline|by)\s+(?:[\w\s,]+\d|\w+day)/gi,
  },
  {
    kind: "number",
    regex: /\b\d+(?:\.\d+)?%/g,
  },
];

function highlightClass(kind: HighlightKind): string {
  switch (kind) {
    case "money":
      return "cdl-highlight-money";
    case "date":
    case "deadline":
      return "cdl-highlight-date";
    case "number":
      return "cdl-highlight-number";
    case "person":
      return "cdl-highlight-person";
    default:
      return "cdl-highlight";
  }
}

type Segment = { text: string; kind?: HighlightKind };

function segmentText(text: string, knownNames: string[]): Segment[] {
  const matches: Array<{ start: number; end: number; kind: HighlightKind }> = [];

  for (const name of knownNames) {
    if (!name.trim()) continue;
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, kind: "person" });
    }
  }

  for (const { kind, regex } of PATTERNS) {
    const r = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, kind });
    }
  }

  matches.sort((a, b) => a.start - b.start);
  const merged: typeof matches = [];
  for (const m of matches) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) continue;
    merged.push(m);
  }

  if (merged.length === 0) return [{ text }];

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.start > cursor) segments.push({ text: text.slice(cursor, m.start) });
    segments.push({ text: text.slice(m.start, m.end), kind: m.kind });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

interface HighlightedTextProps {
  text: string;
  knownNames?: string[];
  className?: string;
}

export function HighlightedText({ text, knownNames = [], className }: HighlightedTextProps) {
  const segments = segmentText(text, knownNames);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind ? (
          <span key={i} className={highlightClass(seg.kind)}>
            {seg.text}
          </span>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        )
      )}
    </span>
  );
}
