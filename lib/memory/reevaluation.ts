/**
 * Phase 2 Mem0 decision criteria. Revisit after Phase 1 retrieval is live.
 * Log recall sources during normal operation to compare keyword vs File Search hit rates.
 */

export type RecallSource = "keyword" | "file_search";

export interface RecallObservation {
  source: RecallSource;
  query: string;
  hitCount: number;
  context: "extraction" | "voice_qa";
}

export const MEM0_REEVALUATION_CRITERIA = [
  "Voice Q&A still misses paraphrased questions when File Search returns zero hits but keyword search also fails",
  "Extraction context lacks prior-session facts that exist in transcripts but not in knowledge_objects",
  "User-level memory is needed across multiple recording_key workspaces",
  "Platform alignment with Stylist worker Mem0 sync becomes a product requirement",
] as const;

const observations: RecallObservation[] = [];
const MAX_OBSERVATIONS = 200;

export function recordRecallObservation(observation: RecallObservation): void {
  observations.push(observation);
  if (observations.length > MAX_OBSERVATIONS) {
    observations.shift();
  }
}

export function getRecallObservations(): readonly RecallObservation[] {
  return observations;
}

/** True when File Search underperforms keyword search — a signal to consider Mem0. */
export function shouldConsiderMem0(): boolean {
  const recent = observations.slice(-50);
  if (recent.length < 10) return false;

  const fileSearchMisses = recent.filter(
    (o) => o.source === "file_search" && o.hitCount === 0
  ).length;
  const keywordHits = recent.filter(
    (o) => o.source === "keyword" && o.hitCount > 0
  ).length;

  return fileSearchMisses >= 5 && keywordHits >= 3;
}
