"use client";

import type { ActivityOutcome, InsightsData, KnowledgeObject } from "@/types";
import type { AttentionStatus } from "@/types";
import type { PipelinePhase } from "@/lib/processing/pipeline-ui";
import { recordingKeyHeaders } from "@/lib/recording/recording-key";

function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...recordingKeyHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchHomeData(): Promise<{
  todayItems: KnowledgeObject[];
  recentActivity: ActivityOutcome[];
}> {
  const res = await apiFetch("/api/knowledge-objects?view=home");
  if (!res.ok) throw new Error("Failed to load home data");
  return res.json();
}

export async function fetchTimelineGroups(): Promise<
  Array<{ label: string; objects: KnowledgeObject[] }>
> {
  const res = await apiFetch("/api/knowledge-objects?view=timeline");
  if (!res.ok) throw new Error("Failed to load library");
  const data = await res.json();
  return data.groups;
}

export async function fetchKnowledgeObject(id: string): Promise<KnowledgeObject | null> {
  const res = await apiFetch(`/api/knowledge-objects/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load object");
  const data = await res.json();
  return data.object;
}

export async function fetchRelatedObjects(objectId: string): Promise<KnowledgeObject[]> {
  const res = await apiFetch(
    `/api/knowledge-objects?relatedTo=${encodeURIComponent(objectId)}`
  );
  if (!res.ok) throw new Error("Failed to load related objects");
  const data = await res.json();
  return data.objects;
}

export async function searchKnowledgeObjectsApi(query: string): Promise<KnowledgeObject[]> {
  const res = await apiFetch(`/api/knowledge-objects?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.objects;
}

export async function fetchSessionObjects(sessionId: string): Promise<KnowledgeObject[]> {
  const res = await apiFetch(
    `/api/knowledge-objects?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error("Failed to load session results");
  const data = await res.json();
  return data.objects;
}

export async function fetchSessionObservations(sessionId: string) {
  const res = await apiFetch(
    `/api/observations?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error("Failed to load observations");
  const data = await res.json();
  return data.observations as import("@/types").RecordingObservation[];
}

export interface ProcessingStatusPayload {
  status: string;
  processingStep: number;
  errorMessage?: string | null;
  enrichmentStatus?: string;
  pipelinePhase?: PipelinePhase | string;
  observationCount?: number;
  objectCount?: number;
  analystSummary?: string;
}

export async function fetchSessionSummary(sessionId: string) {
  const res = await apiFetch(
    `/api/recordings/session?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error("Failed to load session summary");
  return res.json() as Promise<{
    sessionId: string;
    durationSeconds: number | null;
    attachmentCount: number;
    attachmentNames: string[];
    status: string;
    createdAt: string;
    errorMessage?: string | null;
    enrichmentStatus?: string;
    pipelinePhase?: string;
    analystSummary?: string;
    observationCount?: number;
    objectCount?: number;
  }>;
}

export async function fetchSessions() {
  const res = await apiFetch("/api/recordings");
  if (!res.ok) throw new Error("Failed to load sessions");
  const data = await res.json();
  return data.sessions as Array<{
    id: string;
    status: string;
    durationSeconds: number | null;
    createdAt: string;
    objectCount: number;
    observationCount: number;
    errorMessage: string | null;
  }>;
}

export async function deleteSessionApi(sessionId: string) {
  const res = await apiFetch(
    `/api/recordings/session?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Delete failed");
  }
}

export async function retrySessionApi(sessionId: string) {
  const res = await apiFetch("/api/recordings/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "retry" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Retry failed");
  }
}

export async function updateKnowledgeObjectApi(
  id: string,
  patch: {
    title?: string;
    subtitle?: string | null;
    previewContent?: string;
    status?: AttentionStatus;
    dueAt?: string | null;
    relatedObjectIds?: string[];
  }
) {
  const res = await apiFetch(`/api/knowledge-objects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Update failed");
  }
  const data = await res.json();
  return data.object as KnowledgeObject;
}

export async function deleteKnowledgeObjectApi(id: string) {
  const res = await apiFetch(`/api/knowledge-objects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Delete failed");
  }
}

export async function fetchInsights(): Promise<InsightsData> {
  const res = await apiFetch("/api/insights");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load insights");
  }
  return res.json();
}

export async function processRecording(sessionId: string) {
  const res = await apiFetch("/api/recordings/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Processing failed");
  }
  return res.json() as Promise<{
    success: boolean;
    status: string;
    processingStep: number;
    objectCount?: number;
  }>;
}

export async function fetchAttachments(sessionId: string) {
  const res = await apiFetch(
    `/api/recordings/attachments?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) throw new Error("Failed to load attachments");
  const data = await res.json();
  return data.attachments as Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sortOrder: number;
    createdAt: string;
  }>;
}

export async function uploadAttachment(sessionId: string, file: File) {
  const formData = new FormData();
  formData.append("sessionId", sessionId);
  formData.append("file", file, file.name);
  const res = await apiFetch("/api/recordings/attachments", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Upload failed");
  }
  const data = await res.json();
  return data.attachment;
}

export async function deleteAttachment(sessionId: string, attachmentId: string) {
  const res = await apiFetch(
    `/api/recordings/attachments?sessionId=${encodeURIComponent(sessionId)}&attachmentId=${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Delete failed");
  }
}

export async function mergeAnonymousWorkspace() {
  const res = await apiFetch("/api/auth/merge", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Merge failed");
  }
}

export async function fetchAuthProfile() {
  const res = await apiFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json() as Promise<{
    user: { id: string; email?: string; name?: string };
    recordingKey: string;
  }>;
}

export async function pollProcessingStatus(sessionId: string): Promise<ProcessingStatusPayload> {
  const res = await apiFetch(
    `/api/recordings/process?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Failed to get status (${res.status})`
    );
  }
  return res.json() as Promise<ProcessingStatusPayload>;
}

export const ACTIVE_PROCESSING_KEY = "chrysty-active-processing";

export function setActiveProcessing(sessionId: string) {
  sessionStorage.setItem(
    ACTIVE_PROCESSING_KEY,
    JSON.stringify({ sessionId, startedAt: Date.now() })
  );
  sessionStorage.setItem("chrysty-session-id", sessionId);
}

export function clearActiveProcessing() {
  sessionStorage.removeItem(ACTIVE_PROCESSING_KEY);
}

export function getActiveProcessing(): { sessionId: string; startedAt: number } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ACTIVE_PROCESSING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { sessionId: string; startedAt: number };
  } catch {
    return null;
  }
}
