"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Link from "next/link";

import { motion } from "framer-motion";

import { ProcessingAnimation } from "@/components/recording/ProcessingAnimation";

import {

  clearActiveProcessing,

  pollProcessingStatus,

  processRecording,

  retrySessionApi,

  setActiveProcessing,

} from "@/lib/data-client";

import { pageTransition } from "@/lib/motion";

import {

  toastProcessingComplete,

  toastProcessingFailed,

  toastProcessingStarted,

} from "@/lib/toast";



export default function ProcessingPage() {

  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);

  const [pipelinePhase, setPipelinePhase] = useState<string | undefined>();

  const [observationCount, setObservationCount] = useState(0);

  const [enrichmentStatus, setEnrichmentStatus] = useState<string | undefined>();

  const [error, setError] = useState<string | null>(null);

  const [pollWarning, setPollWarning] = useState<string | null>(null);

  const [slowWarning, setSlowWarning] = useState(false);

  const [startedAt, setStartedAt] = useState<number | undefined>();

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [retryKey, setRetryKey] = useState(0);

  const jobStarted = useRef(false);

  const redirected = useRef(false);

  const pollFailCount = useRef(0);



  const handleRetry = useCallback(async () => {

    if (!sessionId) return;

    setError(null);

    setPollWarning(null);

    setSlowWarning(false);

    pollFailCount.current = 0;

    jobStarted.current = false;

    redirected.current = false;

    try {

      await retrySessionApi(sessionId);

      setActiveProcessing(sessionId);

      setStartedAt(Date.now());

      setRetryKey((k) => k + 1);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Retry failed");

    }

  }, [sessionId]);



  useEffect(() => {

    const id =

      sessionStorage.getItem("chrysty-session-id") ??

      JSON.parse(sessionStorage.getItem("chrysty-active-processing") ?? "null")?.sessionId;

    if (!id) {

      router.replace("/");

      return;

    }

    setSessionId(id);

    const active = JSON.parse(

      sessionStorage.getItem("chrysty-active-processing") ?? "null"

    ) as { startedAt?: number } | null;

    setStartedAt(active?.startedAt ?? Date.now());

    setActiveProcessing(id);

    toastProcessingStarted();

  }, [router]);



  useEffect(() => {

    if (!sessionId) return;



    let cancelled = false;

    let pollTimer: ReturnType<typeof setInterval> | null = null;



    const finishSuccess = (observationCount?: number, objectCount?: number) => {

      if (redirected.current || cancelled) return;

      redirected.current = true;

      if (pollTimer) clearInterval(pollTimer);

      clearActiveProcessing();

      toastProcessingComplete({ observationCount, objectCount });

      router.push(`/results/${sessionId}`);

    };



    const finishFailed = (message: string) => {

      if (cancelled) return;

      if (pollTimer) clearInterval(pollTimer);

      clearActiveProcessing();

      setError(message);

      toastProcessingFailed(message, () => {

        void handleRetry();

      });

    };



    const poll = async () => {

      try {

        const status = await pollProcessingStatus(sessionId);

        if (cancelled || redirected.current) return;

        if (status.processingStep >= 0) {

          setCurrentStep(status.processingStep);

        }

        setPipelinePhase(status.pipelinePhase);

        setObservationCount(status.observationCount ?? 0);

        setEnrichmentStatus(status.enrichmentStatus);

        if (status.status === "completed") {

          finishSuccess(status.observationCount, status.objectCount);

        } else if (status.status === "failed") {

          finishFailed(status.errorMessage ?? "Processing failed");

        }

        pollFailCount.current = 0;

        setPollWarning(null);

      } catch (err) {

        pollFailCount.current += 1;

        if (pollFailCount.current >= 3) {

          const message =

            err instanceof Error ? err.message : "Connection issue while checking status";

          setPollWarning(message);

        }

      }

    };



    void poll();

    pollTimer = setInterval(poll, 1500);



    if (!jobStarted.current) {

      jobStarted.current = true;

      void processRecording(sessionId).catch((err) => {

        if (!cancelled && !redirected.current) {

          const message = err instanceof Error ? err.message : "Failed to start processing";

          finishFailed(message);

        }

      });

    }



    const timeoutTimer = setTimeout(() => {

      if (!cancelled && !redirected.current) {

        setSlowWarning(true);

      }

    }, 240000);



    return () => {

      cancelled = true;

      if (pollTimer) clearInterval(pollTimer);

      clearTimeout(timeoutTimer);

    };

  }, [sessionId, router, handleRetry, retryKey]);



  return (

    <motion.div

      {...pageTransition}

      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"

    >

      {error ? (

        <div className="space-y-4 px-8 text-center">

          <p className="text-lg font-medium text-foreground">Something went wrong</p>

          <p className="text-sm text-muted-foreground">{error}</p>

          {sessionId ? (
            <p className="text-xs text-muted-foreground">Session: {sessionId}</p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3">

            <button

              type="button"

              onClick={() => void handleRetry()}

              className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-foreground"

            >

              Retry

            </button>

            <button

              type="button"

              onClick={() => router.push("/")}

              className="rounded-full border border-border px-6 py-2 text-sm font-medium"

            >

              Back to Home

            </button>

          </div>

        </div>

      ) : (

        <>

          {(pollWarning || slowWarning) && (

            <div className="mb-6 max-w-sm space-y-2 px-8 text-center">

              {pollWarning && (

                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">

                  {pollWarning} — retrying…

                </p>

              )}

              {slowWarning && (

                <p className="rounded-xl border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">

                  Taking longer than usual. You can browse home — we&apos;ll keep working.

                </p>

              )}

            </div>

          )}

          <ProcessingAnimation

            currentStep={currentStep}

            startedAt={startedAt}

            pipelinePhase={pipelinePhase}

            observationCount={observationCount}

            enrichmentStatus={enrichmentStatus}

          />

          <Link

            href="/"

            className="mt-10 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"

          >

            Browse while we work

          </Link>

        </>

      )}

    </motion.div>

  );

}

