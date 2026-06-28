import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import type {
  ObservationCategory,
  ObservationChangeType,
} from "@/lib/agents/observation-schema";

export type KnowledgeObjectType =
  | "document"
  | "attention"
  | "person"
  | "place"
  | "idea"
  | "company"
  | "event"
  | "object";

export type AttentionStatus = "pending" | "waiting" | "due" | "completed";

export type UseCaseCategory =
  | "knowledge_capture"
  | "work_documentation"
  | "decision_log"
  | "personal_memory"
  | "long_form_creation";

export type { ChrystyDocument, ObservationCategory, ObservationChangeType };

export interface ObservationRoutingHints {
  agents?: Array<"entity" | "timeline" | "task" | "memory" | "document">;
  priority?: "low" | "medium" | "high";
}

export interface RecordingObservation {
  id: string;
  recordingKey: string;
  sessionId: string;
  category: ObservationCategory;
  title: string;
  body: string;
  sourceQuote?: string;
  sourceTimestamp?: string;
  changeType: ObservationChangeType;
  canonicalKey?: string;
  supersedesId?: string;
  affectedEntityKeys?: string[];
  attributes?: Record<string, unknown>;
  importance?: number;
  shortTermImportance?: number;
  confidence?: number;
  novelty?: number;
  updateExisting?: boolean;
  createNew?: boolean;
  needsFollowUp?: boolean;
  needsReminder?: boolean;
  needsHumanReview?: boolean;
  routingHints?: ObservationRoutingHints;
  materializedObjectIds?: string[];
  geminiInteractionId?: string;
  createdAt: string;
}

export interface KnowledgeObject {
  id: string;
  type: KnowledgeObjectType;
  title: string;
  subtitle?: string;
  status?: AttentionStatus;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceRecordingId?: string;
  sessionSummaryLine?: string;
  mentionCount?: number;
  sourceQuote?: string;
  previewContent?: string;
  presentationDocument?: ChrystyDocument;
  relatedObjectIds?: string[];
  canonicalKey?: string;
  activeVersionId?: string;
  attributes?: Record<string, unknown>;
  versionNumber?: number;
}

export interface ActivityOutcome {
  id: string;
  label: string;
  objectId?: string;
  sessionSummaryLine?: string;
}

export interface RankedItem {
  id: string;
  label: string;
  count: number;
  trend?: "up" | "down" | "stable";
}

export interface TimeAllocationSlice {
  label: string;
  percentage: number;
}

export interface AttentionStats {
  created: number;
  completed: number;
  pending: number;
  period: string;
}

export interface MoodDataPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface SpeakingTrends {
  avgDurationMinutes: number;
  recordingsPerWeek: number;
  peakHour: string;
  mostProductiveDay: string;
  mostActiveMonth: string;
}

export interface KnowledgeGrowthPoint {
  date: string;
  entities: number;
  connections: number;
}

export interface InsightsData {
  mostMentionedPeople: RankedItem[];
  topics: RankedItem[];
  projects: RankedItem[];
  locations: RankedItem[];
  objects: RankedItem[];
  timeAllocation: TimeAllocationSlice[];
  attentionStats: AttentionStats;
  moodOverTime: MoodDataPoint[];
  speakingTrends: SpeakingTrends;
  knowledgeGrowth: KnowledgeGrowthPoint[];
  documentsGenerated: number;
  recommendations?: InsightRecommendation[];
}

export interface InsightRecommendation {
  id: string;
  title: string;
  body: string;
  presentationDocument?: ChrystyDocument;
  patternKey?: string | null;
  createdAt: string;
}

export interface TimelineGroup {
  label: string;
  objectIds: string[];
}

export interface RecordingSession {
  id: string;
  useCase: UseCaseCategory;
  discoveredObjectIds: string[];
  completedAt: string;
}
