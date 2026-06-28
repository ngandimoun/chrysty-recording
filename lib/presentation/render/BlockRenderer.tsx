"use client";

import type { DocumentBlock } from "@/lib/presentation/schema/document";
import type { DocumentThemeConfig } from "@/lib/presentation/themes";
import { iconForBlockType } from "@/lib/presentation/cdl/icons";
import { HighlightedText } from "@/lib/presentation/render/HighlightedText";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Minus,
  Square,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const sectionTitles: Partial<Record<DocumentBlock["type"], string>> = {
  summary: "Summary",
  people: "People",
  companies: "Companies",
  checklist: "Action Items",
  timeline: "Timeline",
  decisions: "Decisions",
  metrics: "Metrics",
  table: "Details",
  references: "References",
  imageGallery: "Photos",
};

function cardClass(style: DocumentThemeConfig["cardStyle"]): string {
  switch (style) {
    case "elevated":
      return "rounded-[20px] border border-border bg-card p-4 shadow-soft";
    case "flat":
      return "rounded-[20px] bg-muted/30 p-4";
    default:
      return "rounded-[20px] border border-border/60 bg-card/80 p-4";
  }
}

function personInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function splitChecklistText(text: string): { category?: string; detail: string } {
  const colonIdx = text.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 40) {
    return { category: text.slice(0, colonIdx), detail: text.slice(colonIdx + 2) };
  }
  return { detail: text };
}

function splitDecisionText(text: string): { title?: string; body: string } {
  const dashIdx = text.indexOf(" — ");
  if (dashIdx > 0) {
    return { title: text.slice(0, dashIdx), body: text.slice(dashIdx + 3) };
  }
  return { body: text };
}

function TrendIndicator({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return (
      <span className="cdl-trend cdl-trend-up">
        <TrendingUp className="size-3.5" aria-hidden />
        Up
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="cdl-trend cdl-trend-down">
        <TrendingDown className="size-3.5" aria-hidden />
        Down
      </span>
    );
  }
  return (
    <span className="cdl-trend cdl-trend-stable">
      <Minus className="size-3.5" aria-hidden />
      Stable
    </span>
  );
}

function CalloutIcon({ variant }: { variant: "info" | "warning" | "success" }) {
  if (variant === "warning") return <AlertTriangle className="size-5 shrink-0" aria-hidden />;
  if (variant === "success") return <CheckCircle2 className="size-5 shrink-0" aria-hidden />;
  return <Info className="size-5 shrink-0" aria-hidden />;
}

interface BlockRendererProps {
  block: DocumentBlock;
  themeConfig: DocumentThemeConfig;
  sectionIndex?: number;
  knownNames?: string[];
}

export function BlockRenderer({
  block,
  themeConfig,
  sectionIndex,
  knownNames = [],
}: BlockRendererProps) {
  const Icon = iconForBlockType(block.type);
  const sectionTitle = sectionTitles[block.type];
  const showHeader = sectionTitle && block.type !== "paragraph";

  const densityGap =
    themeConfig.paragraphDensity === "airy"
      ? "space-y-6"
      : themeConfig.paragraphDensity === "compact"
        ? "space-y-2"
        : "space-y-4";

  return (
    <section className={cn("cdl-section-block", densityGap)}>
      {showHeader && (
        <header className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-accent" aria-hidden />}
          <h3 className="cdl-section">
            {themeConfig.numberedSections && sectionIndex != null
              ? `${sectionIndex}. ${sectionTitle}`
              : sectionTitle}
          </h3>
        </header>
      )}

      {block.type === "summary" && (
        <div className="space-y-4">
          {block.paragraphs.map((p, i) => (
            <p key={i} className="cdl-body">
              <HighlightedText text={p} knownNames={knownNames} />
            </p>
          ))}
        </div>
      )}

      {block.type === "paragraph" && (
        <p className="cdl-body">
          <HighlightedText text={block.text} knownNames={knownNames} />
        </p>
      )}

      {block.type === "quote" && (
        <blockquote className={cn(cardClass(themeConfig.cardStyle), "italic")}>
          <p className="cdl-body">&ldquo;{block.text}&rdquo;</p>
          {block.attribution && (
            <footer className="cdl-caption mt-2">— {block.attribution}</footer>
          )}
        </blockquote>
      )}

      {block.type === "checklist" && (
        <ul className="space-y-3">
          {block.items.map((item, i) => {
            const { category, detail } = splitChecklistText(item.text);
            return (
              <li key={i} className={cn(cardClass(themeConfig.cardStyle), "flex gap-3")}>
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border",
                    item.checked
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-muted/40 text-muted-foreground"
                  )}
                >
                  {item.checked ? (
                    <Check className="size-3.5" aria-label="Done" />
                  ) : (
                    <Square className="size-3.5" aria-label="To do" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {category && (
                    <span className="cdl-chip mb-1.5 inline-block">{category}</span>
                  )}
                  <p className="cdl-body">
                    <HighlightedText text={detail} knownNames={knownNames} />
                  </p>
                  {(item.assignee || item.due) && (
                    <p className="cdl-caption mt-1">
                      {[item.assignee, item.due].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {block.type === "timeline" && (
        <ol className="space-y-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              {item.date ? (
                <span className="cdl-date-pill shrink-0">{item.date}</span>
              ) : (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
              )}
              <div className="min-w-0 flex-1 border-l-2 border-border pl-3">
                <p className="cdl-body font-medium">{item.label}</p>
                {item.description && (
                  <p className="cdl-small mt-1 text-muted-foreground">{item.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {block.type === "people" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.people.map((person, i) => (
            <div key={i} className={cn(cardClass(themeConfig.cardStyle), "flex gap-3")}>
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                aria-hidden
              >
                {personInitial(person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="cdl-body font-medium">
                  <HighlightedText text={person.name} knownNames={[person.name]} />
                </p>
                {person.subtitle && (
                  <p className="cdl-small text-muted-foreground">{person.subtitle}</p>
                )}
                {person.role && (
                  <span className="cdl-chip mt-1.5 inline-block">{person.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "companies" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.companies.map((co, i) => (
            <div key={i} className={cardClass(themeConfig.cardStyle)}>
              <p className="cdl-body font-medium">{co.name}</p>
              {co.subtitle && <p className="cdl-small text-muted-foreground">{co.subtitle}</p>}
            </div>
          ))}
        </div>
      )}

      {block.type === "decisions" && (
        <ul className="space-y-2">
          {block.items.map((item, i) => {
            const { title, body } = splitDecisionText(item);
            return (
              <li key={i} className={cn(cardClass(themeConfig.cardStyle), "cdl-body")}>
                {title ? (
                  <>
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="text-muted-foreground"> — </span>
                    <HighlightedText text={body} knownNames={knownNames} />
                  </>
                ) : (
                  <HighlightedText text={body} knownNames={knownNames} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {block.type === "metrics" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.items.map((m, i) => (
            <div key={i} className={cardClass(themeConfig.cardStyle)}>
              <div className="flex items-start justify-between gap-2">
                <p className="cdl-caption">{m.label}</p>
                {m.trend && <TrendIndicator trend={m.trend} />}
              </div>
              <p className="cdl-title mt-1 text-2xl">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {block.type === "table" && (
        <div className="overflow-x-auto rounded-[20px] border border-border/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                {block.headers.map((h, i) => (
                  <th key={i} className="cdl-small px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/30 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="cdl-body px-4 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {block.type === "references" && (
        <ul className="space-y-2">
          {block.items.map((ref, i) => (
            <li key={i} className={cn(cardClass(themeConfig.cardStyle), "cdl-body")}>
              {ref.url ? (
                <a href={ref.url} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  {ref.title}
                </a>
              ) : (
                ref.title
              )}
              {ref.note && <p className="cdl-caption mt-1">{ref.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {block.type === "imageGallery" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.attachmentIds.map((id, i) => (
            <div
              key={id}
              className={cn(
                cardClass(themeConfig.cardStyle),
                "flex aspect-video items-center justify-center bg-muted/40"
              )}
            >
              <div className="text-center">
                <p className="cdl-caption text-muted-foreground">Attachment</p>
                {block.captions?.[i] && <p className="cdl-small mt-1">{block.captions[i]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "callout" && (
        <div
          className={cn(
            "cdl-callout flex gap-3",
            cardClass(themeConfig.cardStyle),
            block.variant === "warning" && "cdl-callout-warning border-destructive/30 bg-destructive/5",
            block.variant === "success" && "cdl-callout-success border-accent/30 bg-accent/5",
            block.variant === "info" && "cdl-callout-info"
          )}
        >
          <CalloutIcon variant={block.variant} />
          <p className="cdl-body min-w-0 flex-1">
            <HighlightedText text={block.text} knownNames={knownNames} />
          </p>
        </div>
      )}

      {block.type === "clause" && (
        <p className="cdl-body leading-loose">{block.text}</p>
      )}

      {block.type === "code" && (
        <pre className="overflow-x-auto rounded-[20px] border border-border bg-muted/30 p-4 font-mono text-sm">
          {block.text}
        </pre>
      )}
    </section>
  );
}
