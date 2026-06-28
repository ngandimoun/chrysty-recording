"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { springGentle } from "@/lib/motion";
import {
  COARSE_STEP_COUNT,
  COARSE_STEP_LABELS,
  formatObservationCountHint,
  getLongWaitHint,
  getSubMessageForPhase,
  parsePipelinePhase,
  type PipelinePhase,
} from "@/lib/processing/pipeline-ui";

interface ProcessingAnimationProps {
  currentStep: number;
  startedAt?: number;
  pipelinePhase?: PipelinePhase | string;
  observationCount?: number;
  enrichmentStatus?: string;
}

export function ProcessingAnimation({
  currentStep,
  startedAt,
  pipelinePhase: pipelinePhaseProp,
  observationCount = 0,
  enrichmentStatus,
}: ProcessingAnimationProps) {
  const reducedMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [subIndex, setSubIndex] = useState(0);

  const pipelinePhase = parsePipelinePhase(pipelinePhaseProp);
  const effectivePhase: PipelinePhase | undefined =
    enrichmentStatus === "running" && currentStep >= 3
      ? "enriching"
      : pipelinePhase;

  useEffect(() => {
    const start = startedAt ?? Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  useEffect(() => {
    const rotate = setInterval(() => {
      setSubIndex((i) => i + 1);
    }, 4000);
    return () => clearInterval(rotate);
  }, [currentStep, effectivePhase]);

  const progress = ((currentStep + 1) / COARSE_STEP_COUNT) * 100;
  const subMessage = getSubMessageForPhase(effectivePhase, currentStep, subIndex);
  const observationHint = formatObservationCountHint(observationCount);
  const longWaitHint = getLongWaitHint(currentStep, elapsed);

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-8">
      <div className="relative flex size-36 items-center justify-center">
        {!reducedMotion && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-accent/10"
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className="absolute inset-3 rounded-full bg-accent/15"
              animate={{ scale: [1.05, 1, 1.05], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </>
        )}
        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-border"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-accent"
            strokeDasharray={2 * Math.PI * 44}
            animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - progress / 100) }}
            transition={springGentle}
          />
        </svg>
        <span className="relative text-lg font-semibold tabular-nums text-foreground">
          {currentStep + 1}/{COARSE_STEP_COUNT}
        </span>
      </div>

      <div className="flex gap-2">
        {COARSE_STEP_LABELS.map((_, i) => (
          <div
            key={i}
            className={`flex size-7 items-center justify-center rounded-full border transition-colors ${
              i < currentStep
                ? "border-accent bg-accent text-accent-foreground"
                : i === currentStep
                  ? "border-accent bg-accent/10"
                  : "border-border bg-muted/30"
            }`}
          >
            {i < currentStep ? (
              <Check className="size-3.5" />
            ) : (
              <span className="size-1.5 rounded-full bg-current opacity-40" />
            )}
          </div>
        ))}
      </div>

      <div className="h-24 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={springGentle}
            className="text-xl font-medium text-foreground"
          >
            {COARSE_STEP_LABELS[currentStep] ?? COARSE_STEP_LABELS[0]}
          </motion.p>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${currentStep}-${effectivePhase ?? "generic"}-${subIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-sm text-muted-foreground"
          >
            {subMessage}
          </motion.p>
        </AnimatePresence>
        {observationHint && currentStep >= 1 && (
          <p className="mt-1 text-xs font-medium text-accent">{observationHint}</p>
        )}
        <p className="mt-3 text-xs tabular-nums text-muted-foreground/70">
          {formatElapsed(elapsed)}
          {longWaitHint ? ` · ${longWaitHint}` : ""}
        </p>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")} elapsed`;
}
