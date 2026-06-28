"use client";

import type { KnowledgeObject, AttentionStatus } from "@/types";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { fadeSlideUp } from "@/lib/motion";
import { KnowledgeTypeIconBadge } from "@/components/shared/KnowledgeTypeIconBadge";
import { updateKnowledgeObjectApi } from "@/lib/data-client";
import { toastError, toastSaved } from "@/lib/toast";
import { formatDueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { presentationPreviewText } from "@/components/presentation/PresentationDocumentView";

interface AttentionItemCardProps {
  object: KnowledgeObject;
  index?: number;
  locale?: string;
  onStatusChange?: (id: string, status: AttentionStatus) => void;
}

export function AttentionItemCard({
  object,
  index = 0,
  locale,
  onStatusChange,
}: AttentionItemCardProps) {
  const isCompleted = object.status === "completed";
  const preview = presentationPreviewText(object);
  const dueLabel = object.dueAt
    ? formatDueDate(object.dueAt, locale)
    : preview ?? object.subtitle;

  const toggleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next: AttentionStatus = isCompleted ? "pending" : "completed";
    try {
      await updateKnowledgeObjectApi(object.id, { status: next });
      onStatusChange?.(object.id, next);
      toastSaved(isCompleted ? "Marked pending" : "Marked complete");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <motion.div {...fadeSlideUp} transition={{ delay: index * 0.05 }}>
      <div className="group flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3 shadow-soft">
        <button
          type="button"
          onClick={toggleStatus}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            isCompleted
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:border-accent/40"
          )}
          aria-label={isCompleted ? "Mark pending" : "Mark complete"}
        >
          {isCompleted ? <Check className="size-4" /> : <Circle className="size-4" />}
        </button>
        <Link href={`/library/${object.id}`} className="group/link flex min-w-0 flex-1 items-center gap-3">
          <KnowledgeTypeIconBadge type={object.type} size="sm" />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-medium text-foreground",
                isCompleted && "text-muted-foreground line-through"
              )}
            >
              {object.title}
            </p>
            {dueLabel && (
              <p className="truncate text-sm text-muted-foreground line-clamp-1">{dueLabel}</p>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
