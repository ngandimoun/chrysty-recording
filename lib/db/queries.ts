import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase/admin";
import { isDueTodayOrOverdue } from "@/lib/format";
import { deleteSessionStorage, deleteStoragePaths } from "@/lib/storage/cleanup";
import {
  generateObjectId,
  rowToKnowledgeObject,
  rowToSessionAttachment,
  type KnowledgeObjectRow,
  type RecordingSessionRow,
  type SessionAttachment,
  type SessionAttachmentRow,
  type SessionStatus,
} from "@/lib/db/types";
import type {
  AttentionStatus,
  InsightsData,
  KnowledgeObject,
  KnowledgeObjectType,
  UseCaseCategory,
} from "@/types";
import { formatSessionSummaryLine } from "@/lib/format-session";
import { countObservationsForSession } from "@/lib/db/observations";

export async function getSessionIdsForRecordingKey(recordingKey: string): Promise<string[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .select("id")
    .eq("recording_key", recordingKey);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

export async function getSessionForRecordingKey(
  recordingKey: string,
  sessionId: string
): Promise<RecordingSessionRow | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (error) throw error;
  return data as RecordingSessionRow | null;
}

export async function getSession(id: string): Promise<RecordingSessionRow | null> {
  const { data, error } = await createAdminClient()
    .from("recording_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as RecordingSessionRow | null;
}

export async function getSessionsForRecordingKey(
  recordingKey: string
): Promise<RecordingSessionRow[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .select("*")
    .eq("recording_key", recordingKey)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecordingSessionRow[];
}

export async function listSessionsForRecordingKey(
  recordingKey: string,
  options?: { limit?: number; status?: SessionStatus }
) {
  let q = createUntypedAdminClient()
    .from("recording_sessions")
    .select("id, status, duration_seconds, created_at, use_case, processing_step, error_message")
    .eq("recording_key", recordingKey)
    .order("created_at", { ascending: false });
  if (options?.status) q = q.eq("status", options.status);
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const withCounts = await Promise.all(
    rows.map(async (row) => {
      const sessionId = row.id as string;
      const { count: objectCount } = await createAdminClient()
        .from("knowledge_objects")
        .select("*", { count: "exact", head: true })
        .eq("source_recording_id", sessionId);
      const observationCount = await countObservationsForSession(sessionId);
      return {
        id: sessionId,
        status: row.status as string,
        durationSeconds: row.duration_seconds as number | null,
        createdAt: row.created_at as string,
        useCase: row.use_case as string,
        processingStep: row.processing_step as number,
        errorMessage: row.error_message as string | null,
        objectCount: objectCount ?? 0,
        observationCount,
      };
    })
  );
  return withCounts;
}

export async function createSession(params: {
  id: string;
  audioPath: string;
  durationSeconds?: number;
  useCase?: UseCaseCategory;
  workspaceId?: string;
  userId?: string;
  recordingKey?: string;
  clientTimezone?: string;
}): Promise<RecordingSessionRow> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .upsert({
      id: params.id,
      status: "uploading",
      audio_path: params.audioPath,
      duration_seconds: params.durationSeconds ?? null,
      use_case: params.useCase ?? "knowledge_capture",
      processing_step: 0,
      error_message: null,
      workspace_id: params.workspaceId ?? null,
      user_id: params.userId ?? null,
      recording_key: params.recordingKey ?? null,
      pipeline_state: params.clientTimezone
        ? { clientTimezone: params.clientTimezone }
        : {},
      ...(params.clientTimezone ? { client_timezone: params.clientTimezone } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RecordingSessionRow;
}

export async function updateSession(
  id: string,
  patch: Partial<{
    status: SessionStatus;
    transcript: string;
    transcript_detail: unknown;
    gemini_file_uri: string;
    gemini_interaction_ids: Record<string, unknown>;
    processing_step: number;
    completed_at: string;
    error_message: string | null;
    use_case: UseCaseCategory;
    enrichment_status: string;
    pipeline_state: Record<string, unknown>;
    client_timezone: string | null;
    primary_language: string | null;
  }>
): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function resetSessionForRetry(recordingKey: string, sessionId: string): Promise<void> {
  const session = await getSessionForRecordingKey(recordingKey, sessionId);
  if (!session) throw new Error("Session not found");

  const admin = createUntypedAdminClient();

  const { error: koError } = await admin
    .from("knowledge_objects")
    .delete()
    .eq("source_recording_id", sessionId);
  if (koError) throw koError;

  const sessionScopedDeletes: Array<[string, string]> = [
    ["recording_changes", "source_recording_id"],
    ["recording_knowledge_edges", "source_recording_id"],
    ["recording_enrichment_jobs", "session_id"],
    ["recording_recommendations", "source_recording_id"],
    ["recording_observations", "session_id"],
  ];
  for (const [table, column] of sessionScopedDeletes) {
    const { error } = await admin.from(table).delete().eq(column, sessionId);
    if (error) throw error;
  }

  const { error: sessionError } = await admin
    .from("recording_sessions")
    .update({
      status: "uploading",
      processing_step: 0,
      error_message: null,
      transcript: null,
      transcript_detail: null,
      gemini_file_uri: null,
      gemini_interaction_ids: {},
      pipeline_state: {},
      completed_at: null,
      enrichment_status: "pending",
    })
    .eq("id", sessionId)
    .eq("recording_key", recordingKey);
  if (sessionError) throw sessionError;
}

export async function deleteSession(recordingKey: string, sessionId: string): Promise<void> {
  const session = await getSessionForRecordingKey(recordingKey, sessionId);
  if (!session) throw new Error("Session not found");
  const attachments = await getAttachmentsBySession(sessionId);
  await deleteSessionStorage(
    recordingKey,
    sessionId,
    attachments.map((a) => a.storagePath),
    session.audio_path
  );
  const { error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("recording_key", recordingKey);
  if (error) throw error;
}

export async function getKnowledgeObjectRowsForRecordingKey(
  recordingKey: string
): Promise<KnowledgeObjectRow[]> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeObjectRow[];
}

async function filterRowsByRecordingKey(
  rows: KnowledgeObjectRow[],
  recordingKey: string
): Promise<KnowledgeObjectRow[]> {
  const sessionIds = new Set(await getSessionIdsForRecordingKey(recordingKey));
  return rows.filter((r) =>
    r.source_recording_id ? sessionIds.has(r.source_recording_id) : false
  );
}

export async function insertKnowledgeObject(params: {
  type: KnowledgeObjectType;
  title: string;
  subtitle?: string;
  status?: AttentionStatus;
  dueAt?: string;
  sourceRecordingId: string;
  sourceQuote?: string;
  previewContent?: string;
  relatedObjectIds?: string[];
  id?: string;
  canonicalKey?: string;
  attributes?: Record<string, unknown>;
}): Promise<KnowledgeObject> {
  const now = new Date().toISOString();
  const id = params.id ?? generateObjectId(params.type);
  const row: KnowledgeObjectRow = {
    id,
    type: params.type,
    title: params.title,
    subtitle: params.subtitle ?? null,
    status: params.status ?? null,
    due_at: params.dueAt ?? null,
    created_at: now,
    updated_at: now,
    source_recording_id: params.sourceRecordingId,
    mention_count: 1,
    source_quote: params.sourceQuote ?? null,
    preview_content: params.previewContent ?? null,
    related_object_ids: params.relatedObjectIds ?? null,
    canonical_key: params.canonicalKey ?? null,
    attributes: params.attributes ?? null,
  };
  const { error } = await createUntypedAdminClient().from("knowledge_objects").insert(row);
  if (error) throw error;
  return rowToKnowledgeObject(row);
}

export async function updateKnowledgeObjectDb(
  recordingKey: string,
  id: string,
  patch: Partial<{
    title: string;
    subtitle: string | null;
    previewContent: string;
    status: AttentionStatus;
    dueAt: string | null;
    relatedObjectIds: string[];
  }>
): Promise<KnowledgeObject | null> {
  const existing = await getKnowledgeObjectDb(id, recordingKey);
  if (!existing) return null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.subtitle !== undefined) update.subtitle = patch.subtitle;
  if (patch.previewContent !== undefined) update.preview_content = patch.previewContent;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.relatedObjectIds !== undefined) update.related_object_ids = patch.relatedObjectIds;
  const { error } = await createUntypedAdminClient()
    .from("knowledge_objects")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  return getKnowledgeObjectDb(id, recordingKey);
}

export async function deleteKnowledgeObjectDb(
  recordingKey: string,
  id: string
): Promise<boolean> {
  const existing = await getKnowledgeObjectDb(id, recordingKey);
  if (!existing) return false;
  const { error } = await createAdminClient().from("knowledge_objects").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function updateKnowledgeObjectPreview(
  id: string,
  previewContent: string
): Promise<void> {
  const { error } = await createAdminClient()
    .from("knowledge_objects")
    .update({ preview_content: previewContent, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function linkRelatedObjects(
  objectId: string,
  relatedIds: string[]
): Promise<void> {
  const { error } = await createAdminClient()
    .from("knowledge_objects")
    .update({
      related_object_ids: relatedIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectId);
  if (error) throw error;
}

export async function searchKnowledgeObjectsDb(params: {
  recordingKey: string;
  query?: string;
  type?: KnowledgeObjectType;
  limit?: number;
}): Promise<KnowledgeObject[]> {
  const sessionIds = await getSessionIdsForRecordingKey(params.recordingKey);
  if (sessionIds.length === 0) return [];

  let q = createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.type) q = q.eq("type", params.type);

  const { data, error } = await q;
  if (error) throw error;
  let rows = data as KnowledgeObjectRow[];

  if (params.query?.trim()) {
    const term = params.query.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(term) ||
        (row.subtitle?.toLowerCase().includes(term) ?? false) ||
        (row.source_quote?.toLowerCase().includes(term) ?? false) ||
        (row.preview_content?.toLowerCase().includes(term) ?? false)
    );
  }

  return rows.map(rowToKnowledgeObject);
}

export async function getKnowledgeObjectDb(
  id: string,
  recordingKey?: string
): Promise<KnowledgeObject | null> {
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as KnowledgeObjectRow;
  if (recordingKey) {
    const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
    if (!row.source_recording_id || !sessionIds.includes(row.source_recording_id)) {
      return null;
    }
  }
  return rowToKnowledgeObject(row);
}

export async function getObjectsBySession(
  sessionId: string,
  recordingKey?: string
): Promise<KnowledgeObject[]> {
  if (recordingKey) {
    const session = await getSessionForRecordingKey(recordingKey, sessionId);
    if (!session) return [];
  }
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .eq("source_recording_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as KnowledgeObjectRow[]).map(rowToKnowledgeObject);
}

export async function getRelatedObjects(
  recordingKey: string,
  objectId: string
): Promise<KnowledgeObject[]> {
  const object = await getKnowledgeObjectDb(objectId, recordingKey);
  if (!object) return [];
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];

  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as KnowledgeObjectRow[];

  return rows
    .filter((row) => {
      if (row.id === objectId) return true;
      const related = row.related_object_ids;
      if (Array.isArray(related) && related.includes(objectId)) return true;
      return false;
    })
    .map(rowToKnowledgeObject);
}

export async function getWorkspaceClientTimezone(recordingKey: string): Promise<string> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return "UTC";
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .select("client_timezone, pipeline_state, created_at")
    .in("id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return "UTC";
  const row = data as {
    client_timezone?: string | null;
    pipeline_state?: Record<string, unknown> | null;
  };
  return (
    row.client_timezone?.trim() ||
    String(row.pipeline_state?.clientTimezone ?? "") ||
    "UTC"
  );
}

export async function getRecentSessionLanguages(
  recordingKey: string,
  limit = 10
): Promise<Array<{ primary_language?: string | null; pipeline_state?: Record<string, unknown> | null }>> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const { data, error } = await createUntypedAdminClient()
    .from("recording_sessions")
    .select("primary_language, pipeline_state, created_at")
    .in("id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    primary_language?: string | null;
    pipeline_state?: Record<string, unknown> | null;
  }>;
}

export async function getTodayAttentionItems(recordingKey: string): Promise<KnowledgeObject[]> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const timezone = await getWorkspaceClientTimezone(recordingKey);
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .eq("type", "attention")
    .in("status", ["pending", "due", "waiting"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return (data as KnowledgeObjectRow[])
    .map(rowToKnowledgeObject)
    .filter((item) => isDueTodayOrOverdue(item.dueAt, timezone))
    .slice(0, 10);
}

export async function getRecentActivity(recordingKey: string, limit = 5) {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("id, title, type, created_at, source_recording_id")
    .in("source_recording_id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = data ?? [];
  const ids = [
    ...new Set(
      rows
        .map((row) => row.source_recording_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const summaryLines = await getSessionSummaryLines(ids);

  return rows.map((row) => ({
    id: row.id as string,
    label: row.title as string,
    objectId: row.id as string,
    sessionSummaryLine: row.source_recording_id
      ? summaryLines.get(row.source_recording_id as string)
      : undefined,
  }));
}

export async function getTimelineGroups(
  recordingKey: string
): Promise<Array<{ label: string; objects: KnowledgeObject[] }>> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as KnowledgeObjectRow[];

  const summaryLines = await getSessionSummaryLines(sessionIds);

  const objects = rows.map((row) => {
    const object = rowToKnowledgeObject(row);
    if (row.source_recording_id) {
      object.sessionSummaryLine = summaryLines.get(row.source_recording_id);
    }
    return object;
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  const groups: Record<string, KnowledgeObject[]> = {
    Today: [],
    Yesterday: [],
    "Last Week": [],
    Earlier: [],
  };

  for (const obj of objects) {
    const d = new Date(obj.createdAt);
    if (d >= startOfToday) groups.Today.push(obj);
    else if (d >= startOfYesterday) groups.Yesterday.push(obj);
    else if (d >= startOfWeek) groups["Last Week"].push(obj);
    else groups.Earlier.push(obj);
  }

  return Object.entries(groups)
    .filter(([, objs]) => objs.length > 0)
    .map(([label, objs]) => ({ label, objects: objs }));
}

export async function searchTranscriptsDb(
  query: string,
  recordingKey: string,
  limit = 10
) {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  const term = `%${query.trim()}%`;
  const { data, error } = await createAdminClient()
    .from("recording_sessions")
    .select("id, transcript, transcript_detail, created_at")
    .in("id", sessionIds)
    .ilike("transcript", term)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAttentionItemsDb(
  recordingKey: string,
  status?: AttentionStatus
) {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return [];
  let q = createAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .eq("type", "attention")
    .order("due_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data, error } = await q.limit(20);
  if (error) throw error;
  return (data as KnowledgeObjectRow[]).map(rowToKnowledgeObject);
}

export async function getRecordingSummaryDb(
  sessionId: string,
  recordingKey?: string
) {
  const session = recordingKey
    ? await getSessionForRecordingKey(recordingKey, sessionId)
    : await getSession(sessionId);
  if (!session) return null;
  return {
    id: session.id,
    summary: session.transcript_detail?.summary ?? null,
    transcript: session.transcript,
    createdAt: session.created_at,
  };
}

export async function insertAttachments(
  attachments: Array<{
    id: string;
    sessionId: string;
    fileName: string;
    mimeType: string;
    storagePath: string;
    sortOrder: number;
  }>
): Promise<SessionAttachment[]> {
  if (attachments.length === 0) return [];

  const rows: SessionAttachmentRow[] = attachments.map((a) => ({
    id: a.id,
    session_id: a.sessionId,
    file_name: a.fileName,
    mime_type: a.mimeType,
    storage_path: a.storagePath,
    gemini_file_uri: null,
    error_message: null,
    sort_order: a.sortOrder,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await createUntypedAdminClient()
    .from("session_attachments")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return (data as SessionAttachmentRow[]).map(rowToSessionAttachment);
}

export async function insertSingleAttachment(params: {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sortOrder: number;
}): Promise<SessionAttachment> {
  const [row] = await insertAttachments([params]);
  return row;
}

export async function deleteAttachmentDb(
  recordingKey: string,
  sessionId: string,
  attachmentId: string
): Promise<boolean> {
  const session = await getSessionForRecordingKey(recordingKey, sessionId);
  if (!session) return false;
  const attachments = await getAttachmentsBySession(sessionId);
  const target = attachments.find((a) => a.id === attachmentId);
  if (!target) return false;
  await deleteStoragePaths([target.storagePath]);
  const { error } = await createUntypedAdminClient()
    .from("session_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("session_id", sessionId);
  if (error) throw error;
  return true;
}

export async function getAttachmentsBySession(sessionId: string): Promise<SessionAttachment[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("session_attachments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as SessionAttachmentRow[]).map(rowToSessionAttachment);
}

export async function updateAttachmentGeminiUri(
  id: string,
  patch: { geminiFileUri?: string; errorMessage?: string | null }
): Promise<void> {
  const update: Partial<SessionAttachmentRow> = {};
  if (patch.geminiFileUri !== undefined) update.gemini_file_uri = patch.geminiFileUri;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;

  const { error } = await createUntypedAdminClient()
    .from("session_attachments")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function getSessionSummary(sessionId: string, recordingKey?: string) {
  const session = recordingKey
    ? await getSessionForRecordingKey(recordingKey, sessionId)
    : await getSession(sessionId);
  if (!session) return null;

  const attachments = await getAttachmentsBySession(sessionId);
  const pipelineState = (session.pipeline_state as Record<string, unknown> | null) ?? {};
  const { count: objectCount } = await createAdminClient()
    .from("knowledge_objects")
    .select("*", { count: "exact", head: true })
    .eq("source_recording_id", sessionId);
  const observationCount = await countObservationsForSession(sessionId);

  return {
    sessionId: session.id,
    durationSeconds: session.duration_seconds,
    attachmentCount: attachments.length,
    attachmentNames: attachments.map((a) => a.fileName),
    status: session.status,
    createdAt: session.created_at,
    errorMessage: session.error_message,
    useCase: session.use_case,
    enrichmentStatus: session.enrichment_status ?? "pending",
    pipelinePhase:
      typeof pipelineState.phase === "string" ? pipelineState.phase : undefined,
    analystSummary:
      typeof pipelineState.analystSummary === "string"
        ? pipelineState.analystSummary
        : undefined,
    observationCount,
    objectCount: objectCount ?? 0,
  };
}

export async function getProcessingStatusPayload(session: RecordingSessionRow) {
  const pipelineState = (session.pipeline_state as Record<string, unknown> | null) ?? {};
  const { count: objectCount } = await createAdminClient()
    .from("knowledge_objects")
    .select("*", { count: "exact", head: true })
    .eq("source_recording_id", session.id);
  const observationCount = await countObservationsForSession(session.id);

  return {
    status: session.status,
    processingStep: session.processing_step,
    errorMessage: session.error_message,
    enrichmentStatus: session.enrichment_status ?? "pending",
    pipelinePhase:
      typeof pipelineState.phase === "string" ? pipelineState.phase : undefined,
    analystSummary:
      typeof pipelineState.analystSummary === "string"
        ? pipelineState.analystSummary
        : undefined,
    observationCount,
    objectCount: objectCount ?? 0,
  };
}

async function getSessionSummaryLines(sessionIds: string[]): Promise<Map<string, string>> {
  const lines = new Map<string, string>();
  if (sessionIds.length === 0) return lines;

  const { data: sessions, error: sessionError } = await createAdminClient()
    .from("recording_sessions")
    .select("id, duration_seconds")
    .in("id", sessionIds);
  if (sessionError) throw sessionError;

  const { data: attachments, error: attachmentError } = await createAdminClient()
    .from("session_attachments")
    .select("session_id")
    .in("session_id", sessionIds);
  if (attachmentError) throw attachmentError;

  const counts = new Map<string, number>();
  for (const row of attachments ?? []) {
    const sid = row.session_id as string;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }

  for (const session of sessions ?? []) {
    const id = session.id as string;
    lines.set(
      id,
      formatSessionSummaryLine(
        session.duration_seconds as number | null,
        counts.get(id) ?? 0
      )
    );
  }

  return lines;
}

export async function getVoiceHistoryThread(recordingKey: string) {
  const { data, error } = await createUntypedAdminClient()
    .from("voice_history_threads")
    .select("*")
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; last_interaction_id: string } | null;
}

export async function upsertVoiceHistoryThread(
  recordingKey: string,
  lastInteractionId: string
) {
  const existing = await getVoiceHistoryThread(recordingKey);
  if (existing) {
    const { error } = await createUntypedAdminClient()
      .from("voice_history_threads")
      .update({
        last_interaction_id: lastInteractionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await createUntypedAdminClient()
    .from("voice_history_threads")
    .insert({ last_interaction_id: lastInteractionId, recording_key: recordingKey })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getInsightsSnapshot(recordingKey: string): Promise<InsightsData | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("insights_snapshots")
    .select("data")
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (error) throw error;
  if (!data?.data) return null;
  return data.data as InsightsData;
}

// Legacy export kept for internal filter helper if needed elsewhere
export { filterRowsByRecordingKey };

export async function getKnowledgeObjectByCanonicalKey(
  recordingKey: string,
  canonicalKey: string
): Promise<KnowledgeObject | null> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return null;
  const { data, error } = await createUntypedAdminClient()
    .from("knowledge_objects")
    .select("*")
    .in("source_recording_id", sessionIds)
    .eq("canonical_key", canonicalKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToKnowledgeObject(data as KnowledgeObjectRow) : null;
}

export async function updateKnowledgeObjectFields(
  id: string,
  patch: Partial<{
    title: string;
    subtitle: string | null;
    previewContent: string;
    status: AttentionStatus;
    dueAt: string | null;
    relatedObjectIds: string[];
    mentionCount: number;
    canonicalKey: string;
    activeVersionId: string;
    attributes: Record<string, unknown>;
    presentationDocument: Record<string, unknown>;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.subtitle !== undefined) update.subtitle = patch.subtitle;
  if (patch.previewContent !== undefined) update.preview_content = patch.previewContent;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.relatedObjectIds !== undefined) update.related_object_ids = patch.relatedObjectIds;
  if (patch.mentionCount !== undefined) update.mention_count = patch.mentionCount;
  if (patch.canonicalKey !== undefined) update.canonical_key = patch.canonicalKey;
  if (patch.activeVersionId !== undefined) update.active_version_id = patch.activeVersionId;
  if (patch.attributes !== undefined) update.attributes = patch.attributes;
  if (patch.presentationDocument !== undefined) {
    update.presentation_document = patch.presentationDocument;
  }
  const { error } = await createUntypedAdminClient()
    .from("knowledge_objects")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function insertKnowledgeObjectVersion(params: {
  objectId: string;
  versionNumber: number;
  content: string;
  changeSummary?: string;
  sourceRecordingId?: string;
  geminiInteractionId?: string;
  presentationDocument?: Record<string, unknown>;
}): Promise<string> {
  const id = `kov-${params.objectId}-v${params.versionNumber}`;
  const row: Record<string, unknown> = {
    id,
    object_id: params.objectId,
    version_number: params.versionNumber,
    content: params.content,
    change_summary: params.changeSummary ?? null,
    source_recording_id: params.sourceRecordingId ?? null,
    gemini_interaction_id: params.geminiInteractionId ?? null,
  };
  if (params.presentationDocument) {
    row.presentation_document = params.presentationDocument;
  }
  const { error } = await createUntypedAdminClient()
    .from("knowledge_object_versions")
    .insert(row);
  if (error && params.presentationDocument) {
    delete row.presentation_document;
    const retry = await createUntypedAdminClient()
      .from("knowledge_object_versions")
      .insert(row);
    if (retry.error) throw retry.error;
    return id;
  }
  if (error) throw error;
  return id;
}

export async function getLatestDocumentVersionNumber(objectId: string): Promise<number> {
  const { data, error } = await createUntypedAdminClient()
    .from("knowledge_object_versions")
    .select("version_number")
    .eq("object_id", objectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version_number as number) ?? 0;
}

export async function recordKnowledgeChange(params: {
  recordingKey: string;
  objectId?: string;
  fieldName: string;
  previousValue?: string;
  newValue?: string;
  changeType?: string;
  sourceRecordingId?: string;
}): Promise<string> {
  const id = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await createUntypedAdminClient().from("recording_changes").insert({
    id,
    recording_key: params.recordingKey,
    object_id: params.objectId ?? null,
    field_name: params.fieldName,
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
    change_type: params.changeType ?? "update",
    source_recording_id: params.sourceRecordingId ?? null,
  });
  if (error) throw error;
  return id;
}

export async function insertKnowledgeEdge(params: {
  recordingKey: string;
  fromObjectId: string;
  toObjectId: string;
  relationType: string;
  sourceRecordingId?: string;
}): Promise<void> {
  const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await createUntypedAdminClient().from("recording_knowledge_edges").insert({
    id,
    recording_key: params.recordingKey,
    from_object_id: params.fromObjectId,
    to_object_id: params.toObjectId,
    relation_type: params.relationType,
    source_recording_id: params.sourceRecordingId ?? null,
  });
  if (error) throw error;
}

export async function getSessionChanges(
  recordingKey: string,
  sessionId: string
): Promise<
  Array<{
    id: string;
    fieldName: string;
    previousValue: string | null;
    newValue: string | null;
    objectId: string | null;
  }>
> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_changes")
    .select("id, field_name, previous_value, new_value, object_id")
    .eq("recording_key", recordingKey)
    .eq("source_recording_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fieldName: r.field_name as string,
    previousValue: r.previous_value as string | null,
    newValue: r.new_value as string | null,
    objectId: r.object_id as string | null,
  }));
}

export async function enqueueEnrichmentJobs(
  sessionId: string,
  recordingKey: string,
  jobTypes: string[]
): Promise<void> {
  const rows = jobTypes.map((jobType) => ({
    id: `enr-${sessionId}-${jobType}-${Date.now()}`,
    session_id: sessionId,
    recording_key: recordingKey,
    job_type: jobType,
    status: "pending",
  }));
  const { error } = await createUntypedAdminClient()
    .from("recording_enrichment_jobs")
    .insert(rows);
  if (error) throw error;
}

export async function getPendingEnrichmentJobs(sessionId: string) {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_enrichment_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateEnrichmentJob(
  id: string,
  patch: Partial<{ status: string; error_message: string | null; started_at: string; completed_at: string; attempts: number }>
): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_enrichment_jobs")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function markInsightsStale(recordingKey: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await createUntypedAdminClient()
    .from("insights_snapshots")
    .select("id")
    .eq("recording_key", recordingKey)
    .maybeSingle();

  if (existing) {
    const { error } = await createUntypedAdminClient()
      .from("insights_snapshots")
      .update({ stale_at: now })
      .eq("recording_key", recordingKey);
    if (error) throw error;
    return;
  }

  const { error } = await createUntypedAdminClient().from("insights_snapshots").insert({
    recording_key: recordingKey,
    data: {},
    stale_at: now,
  });
  if (error) throw error;
}

export async function getInsightsSnapshotMeta(recordingKey: string): Promise<{
  data: InsightsData | null;
  staleAt: string | null;
  refreshedAt: string | null;
} | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("insights_snapshots")
    .select("data, stale_at, refreshed_at")
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    data: (data.data as InsightsData) ?? null,
    staleAt: (data.stale_at as string) ?? null,
    refreshedAt: (data.refreshed_at as string) ?? null,
  };
}

export async function upsertInsightsSnapshot(
  recordingKey: string,
  insights: InsightsData
): Promise<void> {
  const now = new Date().toISOString();
  const client = createUntypedAdminClient();

  const { data: existing, error: selectError } = await client
    .from("insights_snapshots")
    .select("id")
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await client
      .from("insights_snapshots")
      .update({
        data: insights,
        refreshed_at: now,
        stale_at: null,
      })
      .eq("recording_key", recordingKey);
    if (error) throw error;
    return;
  }

  const { error } = await client.from("insights_snapshots").insert({
    recording_key: recordingKey,
    data: insights,
    refreshed_at: now,
    stale_at: null,
    created_at: now,
  });
  if (error) throw error;
}

export async function getFileSearchStore(recordingKey: string) {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_file_search_stores")
    .select("*")
    .eq("recording_key", recordingKey)
    .maybeSingle();
  if (error) throw error;
  return data as { gemini_store_name: string } | null;
}

export async function saveFileSearchStore(recordingKey: string, geminiStoreName: string): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_file_search_stores")
    .upsert(
      {
        id: `fss-${recordingKey}`,
        recording_key: recordingKey,
        gemini_store_name: geminiStoreName,
      },
      { onConflict: "recording_key" }
    );
  if (error) throw error;
}

export async function upsertMemoryDocument(params: {
  recordingKey: string;
  sourceType: string;
  sourceId: string;
  geminiDocumentName?: string;
}): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_memory_documents")
    .upsert(
      {
        id: `mem-${params.sourceType}-${params.sourceId}`,
        recording_key: params.recordingKey,
        source_type: params.sourceType,
        source_id: params.sourceId,
        gemini_document_name: params.geminiDocumentName ?? null,
        indexed_at: new Date().toISOString(),
      },
      { onConflict: "recording_key,source_type,source_id" }
    );
  if (error) throw error;
}

export interface RecordingRecommendationRow {
  id: string;
  title: string;
  body: string;
  presentationDocument?: Record<string, unknown>;
  patternKey: string | null;
  sourceRecordingId: string | null;
  createdAt: string;
}

export async function insertRecommendation(params: {
  recordingKey: string;
  title: string;
  body: string;
  patternKey?: string;
  sourceRecordingId?: string;
  presentationDocument?: Record<string, unknown>;
}): Promise<void> {
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row: Record<string, unknown> = {
    id,
    recording_key: params.recordingKey,
    title: params.title,
    body: params.body,
    pattern_key: params.patternKey ?? null,
    source_recording_id: params.sourceRecordingId ?? null,
    dismissed: false,
  };
  if (params.presentationDocument) {
    row.presentation_document = params.presentationDocument;
  }
  const { error } = await createUntypedAdminClient().from("recording_recommendations").insert(row);
  if (error && params.presentationDocument) {
    delete row.presentation_document;
    const retry = await createUntypedAdminClient().from("recording_recommendations").insert(row);
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}

export async function listActiveRecommendations(
  recordingKey: string,
  limit = 5
): Promise<RecordingRecommendationRow[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_recommendations")
    .select("id, title, body, pattern_key, source_recording_id, created_at, presentation_document")
    .eq("recording_key", recordingKey)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    presentationDocument: (row.presentation_document as Record<string, unknown> | null) ?? undefined,
    patternKey: (row.pattern_key as string | null) ?? null,
    sourceRecordingId: (row.source_recording_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function dismissRecommendation(id: string, recordingKey: string): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_recommendations")
    .update({ dismissed: true })
    .eq("id", id)
    .eq("recording_key", recordingKey);
  if (error) throw error;
}

export async function dedupePendingAttentionItems(recordingKey: string): Promise<number> {
  const sessionIds = await getSessionIdsForRecordingKey(recordingKey);
  if (sessionIds.length === 0) return 0;

  const { data, error } = await createAdminClient()
    .from("knowledge_objects")
    .select("id, title, status, created_at")
    .in("source_recording_id", sessionIds)
    .eq("type", "attention")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const byTitle = new Map<string, string>();
  const toDelete: string[] = [];

  for (const row of rows) {
    const key = (row.title as string).trim().toLowerCase();
    const existingId = byTitle.get(key);
    if (existingId) {
      toDelete.push(row.id as string);
    } else {
      byTitle.set(key, row.id as string);
    }
  }

  if (toDelete.length === 0) return 0;

  const { error: deleteError } = await createAdminClient()
    .from("knowledge_objects")
    .delete()
    .in("id", toDelete);
  if (deleteError) throw deleteError;

  return toDelete.length;
}
