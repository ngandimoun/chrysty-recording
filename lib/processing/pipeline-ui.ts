export type PipelinePhase =
  | "transcribing"
  | "observing"
  | "scoring"
  | "planning"
  | "materializing"
  | "finishing"
  | "enriching";

export const COARSE_STEP_COUNT = 4;

export const COARSE_STEP_LABELS = [
  "Transcribing",
  "Observing",
  "Updating knowledge",
  "Finishing up",
] as const;

/** Shorter labels for compact banner UI */
export const COARSE_STEP_LABELS_SHORT = [
  "Transcribing",
  "Observing",
  "Updating",
  "Finishing",
] as const;

/** Default rotating sub-messages per coarse step (when no pipelinePhase) */
export const COARSE_STEP_SUB_MESSAGES: Record<number, string[]> = {
  0: ["Reading your voice…", "Transcribing audio…"],
  1: ["Observing what matters…", "Building your world model…"],
  2: ["Updating entities and memory…", "Materializing knowledge…"],
  3: ["Almost ready…", "Preparing your results…"],
};

/** Phase-specific sub-messages (preferred when pipelinePhase is set) */
export const PHASE_SUB_MESSAGES: Record<PipelinePhase, string> = {
  transcribing: "Transcribing audio…",
  observing: "Observing what matters…",
  scoring: "Scoring significance…",
  planning: "Planning next steps…",
  materializing: "Materializing knowledge…",
  finishing: "Almost ready…",
  enriching: "Indexing for search…",
};

/** Short phase label for banner subtitle */
export const PHASE_LABELS_SHORT: Record<PipelinePhase, string> = {
  transcribing: "Transcribing",
  observing: "Observing",
  scoring: "Scoring",
  planning: "Planning",
  materializing: "Materializing",
  finishing: "Finishing",
  enriching: "Indexing",
};

export function coarseStepForPhase(phase: PipelinePhase | undefined): number {
  switch (phase) {
    case "transcribing":
      return 0;
    case "observing":
    case "scoring":
    case "planning":
      return 1;
    case "materializing":
      return 2;
    case "finishing":
    case "enriching":
      return 3;
    default:
      return 0;
  }
}

export function getSubMessageForPhase(
  phase: PipelinePhase | undefined,
  coarseStep: number,
  rotateIndex: number
): string {
  if (phase && PHASE_SUB_MESSAGES[phase]) {
    return PHASE_SUB_MESSAGES[phase];
  }
  const subs = COARSE_STEP_SUB_MESSAGES[coarseStep] ?? [];
  return subs[rotateIndex % Math.max(subs.length, 1)] ?? "";
}

export function getLongWaitHint(coarseStep: number, elapsedSeconds: number): string | null {
  if (coarseStep === 0 && elapsedSeconds > 30) {
    return "Still working — long recordings take a minute";
  }
  if (coarseStep === 1 && elapsedSeconds > 45) {
    return "Rich recordings take time — we're building your world model";
  }
  return null;
}

export function formatObservationCountHint(count: number): string | null {
  if (count <= 0) return null;
  return `${count} observation${count === 1 ? "" : "s"} captured`;
}

export function formatProcessingCompleteDetail(
  observationCount?: number,
  objectCount?: number
): string | undefined {
  const parts: string[] = [];
  if (observationCount != null && observationCount > 0) {
    parts.push(`${observationCount} observation${observationCount === 1 ? "" : "s"}`);
  }
  if (objectCount != null && objectCount > 0) {
    parts.push(`${objectCount} update${objectCount === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

export function formatSessionMeta(observationCount: number, objectCount: number): string {
  const parts: string[] = [];
  if (observationCount > 0) {
    parts.push(`${observationCount} learned`);
  }
  if (objectCount > 0) {
    parts.push(`${objectCount} created`);
  }
  if (parts.length === 0) return "No results yet";
  return parts.join(" · ");
}

export function parsePipelinePhase(value: unknown): PipelinePhase | undefined {
  if (typeof value !== "string") return undefined;
  if (value in PHASE_SUB_MESSAGES) return value as PipelinePhase;
  return undefined;
}
