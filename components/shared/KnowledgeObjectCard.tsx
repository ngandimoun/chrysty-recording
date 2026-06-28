"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { KnowledgeObject } from "@/types";
import { cn } from "@/lib/utils";
import { cardHover, fadeSlideUp } from "@/lib/motion";
import { presentationPreviewText } from "@/components/presentation/PresentationDocumentView";
import { KnowledgeTypeIconBadge } from "@/components/shared/KnowledgeTypeIconBadge";
import { ChevronRight } from "lucide-react";

const typeLabels: Record<KnowledgeObject["type"], string> = {
  document: "Document",
  attention: "Attention",
  person: "Person",
  place: "Place",
  idea: "Idea",
  company: "Company",
  event: "Event",
  object: "Object",
};

interface KnowledgeObjectCardProps {
  object: KnowledgeObject;
  variant?: "default" | "compact";
  index?: number;
  className?: string;
}

export function KnowledgeObjectCard({
  object,
  variant = "default",
  index = 0,
  className,
}: KnowledgeObjectCardProps) {
  const preview = presentationPreviewText(object);

  return (
    <motion.div
      {...fadeSlideUp}
      transition={{ delay: index * 0.05 }}
    >
      <motion.div {...cardHover}>
        <Link
          href={`/library/${object.id}`}
          className={cn(
            "group flex items-center gap-4 rounded-[20px] border border-border bg-card shadow-soft transition-colors hover:border-accent/20",
            variant === "compact" ? "px-4 py-3" : "px-5 py-4",
            className
          )}
        >
          <KnowledgeTypeIconBadge
            type={object.type}
            size={variant === "compact" ? "sm" : "md"}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{object.title}</p>
              <span className="cdl-chip hidden shrink-0 sm:inline-block">{typeLabels[object.type]}</span>
            </div>
            {object.subtitle && !preview && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{object.subtitle}</p>
            )}
            {preview && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
            )}
            {object.sessionSummaryLine && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                {object.sessionSummaryLine}
              </p>
            )}
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
