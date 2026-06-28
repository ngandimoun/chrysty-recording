"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getRecordingUnavailableMessage } from "@/lib/recording/browser-support";
import { toastError } from "@/lib/toast";

export function RecordButton() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const handleRecord = () => {
    const unavailable = getRecordingUnavailableMessage();
    if (unavailable) {
      toastError(unavailable);
      return;
    }
    router.push("/recording");
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative flex items-center justify-center">
        {!reducedMotion && (
          <div
            className="record-ambient-glow pointer-events-none absolute size-64 rounded-full"
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={handleRecord}
          className="record-button-face relative z-10 flex size-32 items-center justify-center rounded-full text-accent-foreground shadow-soft transition-transform active:scale-95"
          aria-label="Record"
        >
          {!reducedMotion && (
            <>
              <span className="record-pulse-ring record-pulse-ring-1" aria-hidden />
              <span className="record-pulse-ring record-pulse-ring-2" aria-hidden />
              <span className="record-pulse-ring record-pulse-ring-3" aria-hidden />
              <span className="record-pulse-ring record-pulse-ring-4" aria-hidden />
            </>
          )}
          <motion.div
            animate={reducedMotion ? {} : { scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Mic className="relative size-10" />
          </motion.div>
        </button>
      </div>
      <p className="text-lg font-medium text-foreground">Record</p>
    </div>
  );
}
