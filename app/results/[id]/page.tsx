"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { GeneratedArtifactsSection } from "@/components/results/GeneratedArtifactsSection";
import { ObservationsPanel } from "@/components/results/ObservationsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SessionAttachmentsManager } from "@/components/recording/SessionAttachmentsManager";
import {
  deleteSessionApi,
  fetchSessionObjects,
  fetchSessionObservations,
  fetchSessionSummary,
  retrySessionApi,
  setActiveProcessing,
} from "@/lib/data-client";
import { pageTransition, staggerContainer } from "@/lib/motion";
import { toastDeleted, toastError } from "@/lib/toast";
import { RotateCcw, Trash2 } from "lucide-react";
import type { KnowledgeObject, RecordingObservation } from "@/types";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const [objects, setObjects] = useState<KnowledgeObject[]>([]);
  const [observations, setObservations] = useState<RecordingObservation[]>([]);
  const [observationsError, setObservationsError] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<{
    durationSeconds: number | null;
    attachmentCount: number;
    attachmentNames: string[];
    status: string;
    analystSummary?: string;
    enrichmentStatus?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [data, summary] = await Promise.all([
          fetchSessionObjects(sessionId),
          fetchSessionSummary(sessionId),
        ]);
        let obs: RecordingObservation[] = [];
        let obsError: string | null = null;
        try {
          obs = await fetchSessionObservations(sessionId);
        } catch (err) {
          obsError = err instanceof Error ? err.message : "Failed to load observations";
        }
        if (!cancelled) {
          setObjects(data);
          setObservations(obs);
          setObservationsError(obsError);
          setSessionSummary({
            durationSeconds: summary.durationSeconds,
            attachmentCount: summary.attachmentCount,
            attachmentNames: summary.attachmentNames,
            status: summary.status,
            analystSummary: summary.analystSummary,
            enrichmentStatus: summary.enrichmentStatus,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load results");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleDeleteSession = async () => {
    if (!confirm("Delete this recording, its observations, and generated items?")) return;
    try {
      await deleteSessionApi(sessionId);
      toastDeleted("Recording deleted");
      router.push("/library");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRetry = async () => {
    try {
      await retrySessionApi(sessionId);
      setActiveProcessing(sessionId);
      router.push("/processing");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const attachmentsEditable =
    sessionSummary?.status === "failed" || sessionSummary?.status === "uploading";

  if (loading) {
    return <LoadingSkeleton className="mx-5 mt-8 h-48" />;
  }

  if (error) {
    return (
      <div className="px-5 py-10">
        <EmptyState title="Could not load results" description={error} />
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-accent hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const showEnrichmentBanner =
    sessionSummary?.enrichmentStatus === "running" ||
    sessionSummary?.enrichmentStatus === "pending";

  const showEnrichmentFailed = sessionSummary?.enrichmentStatus === "failed";

  return (
    <motion.div {...pageTransition} className="-mx-5 min-h-dvh bg-background pb-10">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <PageHeader title="Results" subtitle="What we learned" showBack backHref="/" />
          <div className="mt-1 flex shrink-0 gap-2">
            {sessionSummary?.status === "failed" && (
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                aria-label="Retry processing"
              >
                <RotateCcw className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteSession}
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-destructive"
              aria-label="Delete recording"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-8 px-5 py-6"
      >
        {showEnrichmentBanner && (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Still indexing for search…
          </p>
        )}

        {showEnrichmentFailed && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            Search indexing did not complete. Your observations and updates are still available.
          </p>
        )}

        {sessionSummary?.analystSummary && (
          <section className="rounded-xl border border-border bg-card/40 px-4 py-4">
            <h2 className="text-sm font-medium text-muted-foreground">Session summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {sessionSummary.analystSummary}
            </p>
          </section>
        )}

        {(attachmentsEditable || (sessionSummary?.attachmentCount ?? 0) > 0) && (
          <SessionAttachmentsManager sessionId={sessionId} editable={attachmentsEditable} />
        )}

        {observationsError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load observations: {observationsError}
          </p>
        ) : (
          <ObservationsPanel observations={observations} />
        )}

        {objects.length === 0 && observations.length === 0 && !observationsError ? (
          <EmptyState
            title="Nothing learned yet"
            description="This recording did not produce observations or updates."
          />
        ) : (
          <GeneratedArtifactsSection objects={objects} />
        )}
      </motion.div>
    </motion.div>
  );
}
