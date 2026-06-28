import type { TranscriptionDetail } from "@/lib/db/types";
import type { GeminiContextPart } from "@/lib/gemini/upload-session-context";
import type { TokenUsageTotals } from "@/lib/gemini/usage";
import type { KnowledgeObject, ObservationRoutingHints, RecordingObservation } from "@/types";

export type { ObservationRoutingHints };

export type RecordingClass = "reminder" | "update" | "meeting" | "brainstorm" | "full";

/** Specialized downstream agents — one responsibility each. */
export type AgentName = "entity" | "timeline" | "task" | "memory" | "document";

/** @deprecated Use PlannerDispatch */
export interface QuickPlan {
  recordingClass: RecordingClass;
  agents: AgentName[];
  affectedCanonicalKeys?: string[];
  searchQueries?: string[];
}

export interface PlannerDispatch {
  recordingClass: RecordingClass;
  agents: AgentName[];
  observationIdsByAgent: Partial<Record<AgentName, string[]>>;
  ignoreObservationIds: string[];
  searchQueries: string[];
  affectedCanonicalKeys: string[];
  documentTypes?: string[];
  analystSummary?: string;
}

export interface RetrievedContext {
  priorTranscripts: Array<{ sessionId: string; excerpt: string; createdAt: string }>;
  memoryExcerpts: Array<{ sessionId?: string; excerpt: string; title?: string }>;
  relatedObjects: KnowledgeObject[];
  priorObservations: RecordingObservation[];
  existingDocuments: Array<{
    id: string;
    title: string;
    canonicalKey?: string;
    previewContent?: string;
    presentationDocument?: import("@/lib/presentation/schema/document").ChrystyDocument;
    versionNumber?: number;
  }>;
}

export interface PipelineContext {
  sessionId: string;
  recordingKey: string;
  transcript: TranscriptionDetail;
  flatTranscript: string;
  contextParts: GeminiContextPart[];
  observations?: RecordingObservation[];
  dispatch?: PlannerDispatch;
  retrieved?: RetrievedContext;
  interactionIds: Record<string, unknown>;
  tokenUsage: TokenUsageTotals;
  savedObjectIds: string[];
  documentMeta: Map<string, { docType: string; objectId: string; updateExisting?: boolean }>;
}

export type EnrichmentJobType =
  | "index_memory"
  | "update_graph"
  | "mark_insights_stale"
  | "recommendations"
  | "cross_analysis"
  | "memory_cleanup"
  | "embed_observations";

export type EnrichmentStatus = "pending" | "running" | "done" | "failed";
