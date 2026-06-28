"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { KnowledgeObjectCard } from "@/components/shared/KnowledgeObjectCard";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import {
  deleteKnowledgeObjectApi,
  fetchKnowledgeObject,
  fetchRelatedObjects,
  updateKnowledgeObjectApi,
} from "@/lib/data-client";
import { formatRelativeTime } from "@/lib/format";
import { KnowledgeTypeIconBadge } from "@/components/shared/KnowledgeTypeIconBadge";
import { pageTransition } from "@/lib/motion";
import { toastDeleted, toastError, toastSaved } from "@/lib/toast";
import {
  hasStructuredPresentation,
  PresentationDocumentView,
} from "@/components/presentation/PresentationDocumentView";
import { isCorruptedPresentation } from "@/lib/presentation/json-fragment";
import { AlertTriangle, Sparkles, Trash2, Check, Circle } from "lucide-react";
import type { AttentionStatus, KnowledgeObject } from "@/types";
import { cn } from "@/lib/utils";

function contentSectionLabel(type: KnowledgeObject["type"]): string {
  if (type === "document") return "Overview";
  if (type === "attention") return "Details";
  return "Content";
}

function hasDisplayableContent(object: KnowledgeObject): boolean {
  return Boolean(object.previewContent || object.presentationDocument || object.sourceQuote);
}

export default function ObjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [object, setObject] = useState<KnowledgeObject | null>(null);
  const [related, setRelated] = useState<KnowledgeObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchKnowledgeObject(params.id),
      fetchRelatedObjects(params.id),
    ])
      .then(([obj, rel]) => {
        setObject(obj);
        setRelated(rel.filter((r) => r.id !== params.id));
        if (obj?.previewContent) setDraftContent(obj.previewContent);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    if (!object) return;
    setSaving(true);
    try {
      const updated = await updateKnowledgeObjectApi(object.id, {
        previewContent: draftContent,
      });
      setObject(updated);
      setEditing(false);
      toastSaved("Document updated");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!object || !confirm("Delete this item?")) return;
    try {
      await deleteKnowledgeObjectApi(object.id);
      toastDeleted("Item deleted");
      router.push("/library");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggleAttentionStatus = async () => {
    if (!object || object.type !== "attention") return;
    const next: AttentionStatus = object.status === "completed" ? "pending" : "completed";
    try {
      const updated = await updateKnowledgeObjectApi(object.id, { status: next });
      setObject(updated);
      toastSaved(next === "completed" ? "Marked complete" : "Marked pending");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) {
    return <LoadingSkeleton className="mx-5 mt-8 h-48" />;
  }

  if (!object) {
    return (
      <div className="py-20 text-center text-muted-foreground">Not found</div>
    );
  }

  const timelineItems = related.filter(
    (r) => r.relatedObjectIds?.includes(object.id) || r.id !== object.id
  );
  const structured = hasStructuredPresentation(object);
  const corrupted = isCorruptedPresentation(object.presentationDocument, object.previewContent);
  const showContentSection =
    object.type === "document" ||
    Boolean(object.previewContent || object.presentationDocument);
  const attentionHeroText = object.sourceQuote ?? object.subtitle;
  const canEditPlainText =
    object.type === "document" && !structured && !corrupted && Boolean(object.previewContent);

  return (
    <motion.div {...pageTransition} className="-mx-5 min-h-dvh bg-background pb-10">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <PageHeader
          title={object.title}
          subtitle={`Updated ${formatRelativeTime(object.updatedAt)}`}
          showBack
          backHref="/library"
        />
      </div>

      <div className="space-y-6 px-5 py-6">
        <div className="group flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <KnowledgeTypeIconBadge type={object.type} size="lg" />
            <span className="cdl-chip normal-case">{object.type.replace("_", " ")}</span>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {object.type === "attention" && attentionHeroText && (
          <div className="cdl-callout cdl-callout-warning flex gap-3 rounded-[20px] border border-destructive/20 bg-destructive/5 px-5 py-4">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground">&ldquo;{attentionHeroText}&rdquo;</p>
          </div>
        )}

        {object.type === "attention" && (
          <button
            type="button"
            onClick={toggleAttentionStatus}
            className={cn(
              "flex w-full items-center gap-3 rounded-[20px] border px-5 py-4 text-left transition-colors",
              object.status === "completed"
                ? "border-accent/30 bg-accent/5"
                : "border-border bg-card hover:border-accent/20"
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border",
                object.status === "completed"
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {object.status === "completed" ? (
                <Check className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
            </span>
            <span className="text-sm font-medium text-foreground">
              {object.status === "completed" ? "Completed — tap to reopen" : "Mark as complete"}
            </span>
          </button>
        )}

        {object.sourceQuote && object.type !== "attention" && (
          <blockquote className="rounded-[20px] border border-border bg-muted/30 px-5 py-4 text-sm italic leading-relaxed text-foreground">
            &ldquo;{object.sourceQuote}&rdquo;
          </blockquote>
        )}

        {showContentSection && (
          <div className="rounded-[20px] border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {contentSectionLabel(object.type)}
              </h2>
              {canEditPlainText && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-accent hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            {structured && object.type === "document" && !editing && (
              <p className="mb-4 text-xs text-muted-foreground">
                Structured content — editing coming soon.
              </p>
            )}

            {editing && canEditPlainText ? (
              <div className="space-y-3">
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  rows={12}
                  className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed text-foreground"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setDraftContent(object.previewContent ?? "");
                    }}
                    className="rounded-full border border-border px-4 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <PresentationDocumentView
                object={object}
                animate={false}
                hideTitle
                compact={object.type !== "document"}
              />
            )}
          </div>
        )}

        {!hasDisplayableContent(object) && object.type !== "attention" && (
          <p className="rounded-[20px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            No content yet.
          </p>
        )}

        {object.mentionCount && object.mentionCount > 0 && (
          <Link
            href="/insights"
            className="flex items-center justify-between rounded-[20px] border border-accent/20 bg-accent/5 px-5 py-4 transition-colors hover:bg-accent/10"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-accent" />
              <span className="text-sm text-foreground">
                Mentioned {object.mentionCount} time{object.mentionCount === 1 ? "" : "s"}
              </span>
            </div>
            <span className="text-sm text-accent">Insights →</span>
          </Link>
        )}

        {related.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Related</h2>
            {related.map((item, index) => (
              <KnowledgeObjectCard key={item.id} object={item} index={index} />
            ))}
          </div>
        )}

        {object.type === "person" && timelineItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
            <div className="space-y-4 border-l border-border pl-4">
              {timelineItems.slice(0, 6).map((item) => (
                <div key={item.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
                  <p className="text-sm text-muted-foreground">
                    {formatRelativeTime(item.updatedAt)}
                  </p>
                  <p className="font-medium text-foreground">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
