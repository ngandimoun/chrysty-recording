/** Model routing for the two-phase pipeline. */
export const GEMINI_MODELS = {
  transcription: "gemini-3-flash-preview",
  observation: "gemini-3.1-flash-lite",
  significanceScorer: "gemini-3.1-flash-lite",
  planner: "gemini-3.1-flash-lite",
  specializedAgent: "gemini-3.1-flash-lite",
  fastExtraction: "gemini-3.1-flash-lite",
  documentUpdate: "gemini-3-flash-preview",
  background: "gemini-3.1-flash-lite",
  voiceQA: "gemini-3-flash-preview",
  /** Legacy default — prefer explicit routing above. */
  default: "gemini-3.5-flash",
} as const;

export type GeminiModelRole = keyof typeof GEMINI_MODELS;

export const EMBEDDING_MODEL = "gemini-embedding-2";
