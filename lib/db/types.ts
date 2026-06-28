import type {
  AttentionStatus,
  KnowledgeObject,
  KnowledgeObjectType,
  UseCaseCategory,
} from "@/types";

export type SessionStatus = "uploading" | "processing" | "completed" | "failed";
export type EnrichmentStatus = "pending" | "running" | "done" | "failed";

export interface RecordingSessionRow {
  id: string;
  status: SessionStatus;
  audio_path: string | null;
  use_case: UseCaseCategory;
  transcript: string | null;
  transcript_detail: TranscriptionDetail | null;
  gemini_file_uri: string | null;
  gemini_interaction_ids: Record<string, unknown> | null;
  processing_step: number;
  duration_seconds: number | null;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  workspace_id?: string | null;
  user_id?: string | null;
  recording_key?: string | null;
  enrichment_status?: EnrichmentStatus;
  pipeline_state?: Record<string, unknown> | null;
  client_timezone?: string | null;
  primary_language?: string | null;
}

export interface TranscriptionDetail {
  summary: string;
  segments: Array<{
    speaker: string;
    timestamp: string;
    content: string;
    language?: string;
    emotion: string;
  }>;
}

export interface KnowledgeObjectRow {
  id: string;
  type: KnowledgeObjectType;
  title: string;
  subtitle: string | null;
  status: AttentionStatus | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  source_recording_id: string | null;
  mention_count: number | null;
  source_quote: string | null;
  preview_content: string | null;
  presentation_document?: Record<string, unknown> | null;
  related_object_ids: string[] | null;
  canonical_key?: string | null;
  active_version_id?: string | null;
  attributes?: Record<string, unknown> | null;
  version_number?: number | null;
}

function presentationFromRow(row: KnowledgeObjectRow): KnowledgeObject["presentationDocument"] {
  const raw = row.presentation_document ?? row.attributes?.presentationDocument;
  if (!raw || typeof raw !== "object") return undefined;
  if (!("schemaVersion" in raw) || !("blocks" in raw)) return undefined;
  return raw as KnowledgeObject["presentationDocument"];
}

export function rowToKnowledgeObject(row: KnowledgeObjectRow): KnowledgeObject {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    status: row.status ?? undefined,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceRecordingId: row.source_recording_id ?? undefined,
    mentionCount: row.mention_count ?? undefined,
    sourceQuote: row.source_quote ?? undefined,
    previewContent: row.preview_content ?? undefined,
    presentationDocument: presentationFromRow(row),
    relatedObjectIds: row.related_object_ids ?? undefined,
    canonicalKey: row.canonical_key ?? undefined,
    activeVersionId: row.active_version_id ?? undefined,
    attributes: row.attributes ?? undefined,
    versionNumber: row.version_number ?? undefined,
  };
}

export function generateObjectId(type: KnowledgeObjectType): string {
  return `ko-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface SessionAttachmentRow {
  id: string;
  session_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  gemini_file_uri: string | null;
  error_message: string | null;
  sort_order: number;
  created_at: string;
}

export interface SessionAttachment {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  geminiFileUri?: string;
  errorMessage?: string;
  sortOrder: number;
  createdAt: string;
}

export function rowToSessionAttachment(row: SessionAttachmentRow & { filename?: string }): SessionAttachment {
  return {
    id: row.id,
    sessionId: row.session_id,
    fileName: row.file_name ?? row.filename ?? "context",
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    geminiFileUri: row.gemini_file_uri ?? undefined,
    errorMessage: row.error_message ?? undefined,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}
