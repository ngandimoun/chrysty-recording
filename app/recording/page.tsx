"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Mic } from "lucide-react";
import { AddContextButton } from "@/components/recording/AddContextButton";
import { RecordingTimer } from "@/components/recording/RecordingTimer";
import { RecordingWaveform } from "@/components/recording/RecordingWaveform";
import { useRecordingStore } from "@/stores/recording-store";
import {
  getRecordingUnavailableMessage,
  supportsPauseResume,
} from "@/lib/recording/browser-support";
import { setActiveProcessing } from "@/lib/data-client";
import { pageTransition } from "@/lib/motion";
import {
  toastRecordingSaved,
  toastUploadFailed,
  toastUploading,
} from "@/lib/toast";

export default function RecordingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const canPause = supportsPauseResume();
  const {
    isRecording,
    isPaused,
    elapsedSeconds,
    startRecording,
    pauseRecording,
    resumeRecording,
    finishRecording,
    tick,
    reset,
  } = useRecordingStore();

  useEffect(() => {
    const unavailable = getRecordingUnavailableMessage();
    if (unavailable) {
      setError(unavailable);
    }

    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRecording, tick]);

  const handleClose = () => {
    reset();
    router.replace("/");
  };

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording();
      setHasStarted(true);
    } catch {
      setError("Microphone access is required to record.");
    }
  };

  const handleFinish = async () => {
    if (!isRecording) return;
    setIsFinishing(true);
    setError(null);
    toastUploading();
    try {
      const sessionId = await finishRecording();
      setActiveProcessing(sessionId);
      toastRecordingSaved();
      router.push("/processing");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save recording";
      setError(message);
      toastUploadFailed(message);
      setIsFinishing(false);
    }
  };

  const statusLabel = !hasStarted
    ? "Tap Start to begin"
    : isPaused
      ? "Paused"
      : "Listening…";

  return (
    <motion.div
      {...pageTransition}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="flex items-center justify-between px-5 pt-safe py-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close recording"
        >
          <ArrowLeft className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <RecordingTimer seconds={elapsedSeconds} />

        <div className="flex flex-col items-center gap-3">
          <div className="flex size-20 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Mic className="size-8" />
          </div>
          <p className="text-muted-foreground">{statusLabel}</p>
        </div>

        {hasStarted ? <RecordingWaveform className="w-full max-w-sm" /> : null}

        {error && (
          <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-safe pb-10">
        {hasStarted ? <AddContextButton /> : null}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isFinishing}
            className="min-h-12 min-w-24 rounded-full border border-destructive/40 bg-destructive/10 px-6 font-medium text-destructive shadow-sm transition-all hover:border-destructive/60 hover:bg-destructive/15 active:scale-95 active:border-destructive active:bg-destructive active:text-destructive-foreground active:shadow-md disabled:opacity-50"
          >
            Cancel
          </button>
          {!hasStarted ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={Boolean(getRecordingUnavailableMessage())}
              className="min-h-12 min-w-28 rounded-full bg-accent px-8 font-medium text-accent-foreground transition-transform active:scale-95 disabled:opacity-50"
            >
              Start
            </button>
          ) : (
            <>
              {canPause ? (
                <button
                  type="button"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  disabled={isFinishing}
                  className="min-h-12 min-w-28 rounded-full border border-border bg-card px-8 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleFinish}
                disabled={isFinishing}
                className="min-h-12 min-w-28 rounded-full bg-accent px-8 font-medium text-accent-foreground transition-transform active:scale-95 disabled:opacity-50"
              >
                {isFinishing ? "Saving…" : "Finish"}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
