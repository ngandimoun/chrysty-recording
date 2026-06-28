"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PresentationDocumentView } from "@/components/presentation/PresentationDocumentView";
import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import { isChrystyDocument } from "@/lib/presentation/schema/document";
import type { RecordingObservation } from "@/types";

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function observationPresentationDoc(obs: RecordingObservation): ChrystyDocument | undefined {
  const raw = obs.attributes?.presentationDocument;
  return isChrystyDocument(raw) ? raw : undefined;
}

function ObservationBadges({ obs }: { obs: RecordingObservation }) {
  const badges: string[] = [];
  if (obs.importance != null && obs.importance >= 0.7) badges.push("Important");
  if (obs.needsReminder) badges.push("Reminder");
  if (obs.changeType === "updated") badges.push("Updated");
  if (obs.changeType === "new") badges.push("New");
  if (obs.category === "preference") badges.push("Preference");

  if (badges.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function ObservationItem({ obs, index }: { obs: RecordingObservation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const quote = obs.sourceQuote;
  const showExpand = quote && quote.length > 120;
  const presentationDoc = observationPresentationDoc(obs);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-[20px] border border-border bg-card px-5 py-4 shadow-soft"
    >
      <h4 className="text-base font-semibold text-foreground">{obs.title}</h4>

      {presentationDoc ? (
        <div className="mt-3">
          <PresentationDocumentView
            object={{
              id: obs.id,
              type: "document",
              title: obs.title,
              createdAt: obs.createdAt,
              updatedAt: obs.createdAt,
              presentationDocument: presentationDoc,
            }}
            animate={false}
            hideTitle
            compact
          />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{obs.body}</p>
      )}

      <ObservationBadges obs={obs} />

      {quote && (
        <div className="mt-3">
          <div className="cdl-callout cdl-callout-info flex gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <p
              className={`text-xs italic leading-relaxed text-muted-foreground ${
                !expanded && showExpand ? "line-clamp-2" : ""
              }`}
            >
              &ldquo;{quote}&rdquo;
            </p>
          </div>
          {showExpand && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 text-xs text-accent hover:underline"
            >
              {expanded ? "Show less" : "Show quote"}
            </button>
          )}
        </div>
      )}
    </motion.li>
  );
}

interface ObservationsPanelProps {
  observations: RecordingObservation[];
}

export function ObservationsPanel({ observations }: ObservationsPanelProps) {
  const grouped = observations.reduce<Record<string, RecordingObservation[]>>((acc, obs) => {
    const key = obs.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(obs);
    return acc;
  }, {});

  const categories = Object.entries(grouped);
  const collapsible = observations.length > 8;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">What we learned</h2>
        <p className="text-sm text-muted-foreground">
          Structured observations — the canonical understanding of this recording.
        </p>
      </div>

      {observations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No structured observations for this session.
        </p>
      ) : (
        categories.map(([category, items]) => (
          <CategoryGroup
            key={category}
            category={category}
            items={items}
            defaultOpen={!collapsible || items.length <= 3}
          />
        ))
      )}
    </section>
  );
}

function CategoryGroup({
  category,
  items,
  defaultOpen,
}: {
  category: string;
  items: RecordingObservation[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="cdl-chip normal-case">
          {humanizeCategory(category)}
          <span className="ml-1.5 font-normal opacity-70">({items.length})</span>
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {items.map((obs, index) => (
              <ObservationItem key={obs.id} obs={obs} index={index} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
