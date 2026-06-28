import { runFastPipeline } from "@/lib/agents/fast-pipeline";
import { runBackgroundEnrichment } from "@/lib/background/run-enrichment-worker";
import { updateSession } from "@/lib/db/queries";
import { trackAgentUsage } from "@/lib/chrysty/track-usage";

export async function runSessionProcessing(sessionId: string): Promise<void> {
  try {
    const { tokenUsage } = await runFastPipeline({
      sessionId,
      onStep: async (step) => {
        await updateSession(sessionId, {
          processing_step: step,
          ...(step < 3 ? { status: "processing" as const } : {}),
        });
      },
    });

    try {
      await trackAgentUsage({
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
      });
    } catch {
      /* usage tracking is best-effort */
    }

    // Background enrichment — never blocks user (runs in same after() continuation)
    runBackgroundEnrichment(sessionId).catch((err) => {
      console.warn("[enrichment] background failed:", err);
      updateSession(sessionId, { enrichment_status: "failed" }).catch(() => {});
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Processing failed";
    const message = `[${sessionId}] ${detail}`;
    await updateSession(sessionId, { status: "failed", error_message: message }).catch(() => {});
    throw err;
  }
}
