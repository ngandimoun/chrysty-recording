"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { DocumentRenderer } from "@/lib/presentation/render/DocumentRenderer";
import { AssemblyProgress } from "@/lib/presentation/assembly/AssemblyProgress";
import { resolveDesign } from "@/lib/presentation/design-engine/resolve";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { textToAnswerDocument } from "@/lib/presentation/helpers/answer-document";
import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import { springGentle } from "@/lib/motion";
import { recordingKeyHeaders } from "@/lib/recording/recording-key";

const ASSEMBLY_SECTIONS = ["Searching", "Summary", "Answer"];

export function VoiceHistoryPrompt() {
  const [query, setQuery] = useState("");
  const [answerDoc, setAnswerDoc] = useState<ChrystyDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [assemblyStep, setAssemblyStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const question = query.trim() || "Who have I talked about the most?";
    setLoading(true);
    setError(null);
    setAnswerDoc(null);
    setAssemblyStep(1);

    try {
      const res = await fetch("/api/insights/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...recordingKeyHeaders(),
        },
        body: JSON.stringify({ question, followUp: false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to get answer");
      }

      setAssemblyStep(2);

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let text = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.text) text += parsed.text;
                } catch {
                  /* ignore */
                }
              }
            }
          }
        }
        setAnswerDoc(prepareDocument(textToAnswerDocument(text, question)));
      } else {
        const data = await res.json();
        const doc = data.document as ChrystyDocument | undefined;
        setAnswerDoc(
          doc
            ? prepareDocument(doc)
            : prepareDocument(textToAnswerDocument(data.answer ?? "", question))
        );
      }
      setAssemblyStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Who have I talked about the most?"
          className="flex h-12 flex-1 items-center rounded-[20px] border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/30 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading}
          className="flex size-12 shrink-0 items-center justify-center rounded-[20px] bg-accent text-accent-foreground disabled:opacity-50"
          aria-label="Ask voice history"
        >
          <Search className="size-4" />
        </button>
      </div>

      {loading && (
        <AssemblyProgress
          sections={ASSEMBLY_SECTIONS}
          completedCount={assemblyStep}
          loading
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springGentle}
            className="rounded-[20px] border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}
        {answerDoc && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springGentle}
            className="rounded-[20px] border border-accent/20 bg-card px-4 py-5 shadow-soft"
          >
            <DocumentRenderer
              resolved={resolveDesign(answerDoc)}
              animate
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
