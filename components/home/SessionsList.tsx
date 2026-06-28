"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trash2, RotateCcw, ChevronRight } from "lucide-react";
import {
  deleteSessionApi,
  fetchSessions,
  retrySessionApi,
  setActiveProcessing,
} from "@/lib/data-client";
import { formatRelativeTime } from "@/lib/format";
import { fadeSlideUp } from "@/lib/motion";
import { formatSessionMeta } from "@/lib/processing/pipeline-ui";
import { toastDeleted, toastError } from "@/lib/toast";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

function statusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    case "uploading":
      return "Ready";
    default:
      return status;
  }
}

export function SessionsList() {
  const router = useRouter();
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      status: string;
      durationSeconds: number | null;
      createdAt: string;
      objectCount: number;
      observationCount: number;
      errorMessage: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Delete this recording?")) return;
    try {
      await deleteSessionApi(sessionId);
      toastDeleted("Recording deleted");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRetry = async (sessionId: string) => {
    try {
      await retrySessionApi(sessionId);
      setActiveProcessing(sessionId);
      router.push("/processing");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (loading) return <LoadingSkeleton className="h-24" />;
  if (sessions.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Recent recordings</h2>
      <div className="space-y-2">
        {sessions.slice(0, 5).map((session, index) => (
          <motion.div
            key={session.id}
            {...fadeSlideUp}
            transition={{ delay: index * 0.04 }}
            className="flex items-center gap-2 rounded-[20px] border border-border bg-card px-4 py-3 shadow-soft"
          >
            <Link
              href={
                session.status === "completed"
                  ? `/results/${session.id}`
                  : session.status === "processing"
                    ? "/processing"
                    : "#"
              }
              onClick={(e) => {
                if (session.status === "processing") {
                  setActiveProcessing(session.id);
                }
                if (session.status === "failed" || session.status === "uploading") {
                  e.preventDefault();
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {formatRelativeTime(session.createdAt)}
                  {session.durationSeconds != null &&
                    ` · ${Math.round(session.durationSeconds / 60)}m`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {statusLabel(session.status)}
                  {session.status === "completed" &&
                    ` · ${formatSessionMeta(session.observationCount ?? 0, session.objectCount)}`}
                </p>
              </div>
              {session.status === "completed" && (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
            {session.status === "failed" && (
              <button
                type="button"
                onClick={() => void handleRetry(session.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                aria-label="Retry processing"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete(session.id)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-destructive"
              aria-label="Delete recording"
            >
              <Trash2 className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
