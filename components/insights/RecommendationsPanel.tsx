"use client";

import type { InsightRecommendation } from "@/types";
import { extractPresentationDocument } from "@/lib/presentation";
import { DocumentRenderer } from "@/lib/presentation/render/DocumentRenderer";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { resolveDesign } from "@/lib/presentation/design-engine/resolve";

interface RecommendationsPanelProps {
  items: InsightRecommendation[];
}

export function RecommendationsPanel({ items }: RecommendationsPanelProps) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const resolved = item.presentationDocument
          ? resolveDesign(prepareDocument(item.presentationDocument))
          : extractPresentationDocument(
              undefined,
              item.body,
              item.title
            );

        return (
          <li
            key={item.id}
            className="rounded-[20px] border border-border/60 bg-card/50 px-4 py-4 shadow-soft"
          >
            <DocumentRenderer resolved={resolved} animate={false} compact />
          </li>
        );
      })}
    </ul>
  );
}
