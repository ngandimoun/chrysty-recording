"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  clearActiveProcessing,
  getActiveProcessing,
  pollProcessingStatus,
  processRecording,
  retrySessionApi,
} from "@/lib/data-client";
import { toastProcessingComplete, toastProcessingFailed } from "@/lib/toast";
import { useRouter } from "next/navigation";
import {
  COARSE_STEP_COUNT,
  COARSE_STEP_LABELS_SHORT,
  PHASE_LABELS_SHORT,
  parsePipelinePhase,
} from "@/lib/processing/pipeline-ui";

export function ProcessingBanner() {
  const router = useRouter();
  const [active, setActive] = useState<{ sessionId: string; startedAt: number } | null>(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<string>("processing");
  const [pipelinePhase, setPipelinePhase] = useState<string | undefined>();

  useEffect(() => {
    setActive(getActiveProcessing());
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let jobTriggered = false;

    const poll = async () => {
      try {
        const result = await pollProcessingStatus(active.sessionId);
        if (cancelled) return;
        setStep(result.processingStep);
        setStatus(result.status);
        setPipelinePhase(result.pipelinePhase);

        if (
          !jobTriggered &&
          (result.status === "uploading" || result.status === "failed")
        ) {
          jobTriggered = true;
          void processRecording(active.sessionId).catch((err) => {
            toastProcessingFailed(
              err instanceof Error ? err.message : "Failed to start processing"
            );
          });
        }

        if (result.status === "completed") {
          clearActiveProcessing();
          setActive(null);
          toastProcessingComplete({
            observationCount: result.observationCount,
            objectCount: result.objectCount,
          });
          router.push(`/results/${active.sessionId}`);
        } else if (result.status === "failed") {
          clearActiveProcessing();
          setActive(null);
          toastProcessingFailed(result.errorMessage ?? "Processing failed", () => {
            void retrySessionApi(active.sessionId).then(() => {
              void processRecording(active.sessionId);
            });
          });
        }
      } catch {
        /* retry on next poll */
      }
    };

    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, router]);

  if (!active || status === "completed") return null;

  const coarseLabel =
    COARSE_STEP_LABELS_SHORT[Math.min(step, COARSE_STEP_LABELS_SHORT.length - 1)] ??
    "Working…";
  const phase = parsePipelinePhase(pipelinePhase);
  const phaseLabel = phase ? PHASE_LABELS_SHORT[phase] : null;
  const stepDetail = phaseLabel
    ? `Step ${Math.min(step + 1, COARSE_STEP_COUNT)}/${COARSE_STEP_COUNT} · ${coarseLabel} · ${phaseLabel}`
    : `Step ${Math.min(step + 1, COARSE_STEP_COUNT)}/${COARSE_STEP_COUNT} · ${coarseLabel}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            Learning from your recording
          </p>
          <p className="truncate text-xs text-muted-foreground">{stepDetail}</p>
        </div>
      </div>
      <Link
        href="/processing"
        className="shrink-0 text-xs font-medium text-accent hover:underline"
      >
        View progress
      </Link>
    </motion.div>
  );
}
