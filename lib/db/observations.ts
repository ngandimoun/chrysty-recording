import { createUntypedAdminClient } from "@/lib/supabase/admin";
import type { AgentName } from "@/lib/agents/types";
import type { ObservationCategory, ObservationChangeType } from "@/lib/agents/observation-schema";
import type { ObservationRoutingHints } from "@/types";
import type { RecordingObservation } from "@/types";

export interface RecordingObservationRow {
  id: string;
  recording_key: string;
  session_id: string;
  category: string;
  title: string;
  body: string;
  source_quote: string | null;
  source_timestamp: string | null;
  change_type: string;
  canonical_key: string | null;
  supersedes_id: string | null;
  affected_entity_keys: string[] | null;
  attributes: Record<string, unknown> | null;
  importance: number | null;
  short_term_importance: number | null;
  confidence: number | null;
  novelty: number | null;
  update_existing: boolean | null;
  create_new: boolean | null;
  needs_follow_up: boolean | null;
  needs_reminder: boolean | null;
  needs_human_review: boolean | null;
  routing_hints: Record<string, unknown> | null;
  embedding: unknown | null;
  embedding_model: string | null;
  materialized_object_ids: string[] | null;
  gemini_interaction_id: string | null;
  created_at: string;
}

export function generateObservationId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToObservation(row: RecordingObservationRow): RecordingObservation {
  const routing = row.routing_hints as ObservationRoutingHints | null;
  return {
    id: row.id,
    recordingKey: row.recording_key,
    sessionId: row.session_id,
    category: row.category as ObservationCategory,
    title: row.title,
    body: row.body,
    sourceQuote: row.source_quote ?? undefined,
    sourceTimestamp: row.source_timestamp ?? undefined,
    changeType: row.change_type as ObservationChangeType,
    canonicalKey: row.canonical_key ?? undefined,
    supersedesId: row.supersedes_id ?? undefined,
    affectedEntityKeys: row.affected_entity_keys ?? undefined,
    attributes: row.attributes ?? undefined,
    importance: row.importance ?? undefined,
    shortTermImportance: row.short_term_importance ?? undefined,
    confidence: row.confidence ?? undefined,
    novelty: row.novelty ?? undefined,
    updateExisting: row.update_existing ?? undefined,
    createNew: row.create_new ?? undefined,
    needsFollowUp: row.needs_follow_up ?? undefined,
    needsReminder: row.needs_reminder ?? undefined,
    needsHumanReview: row.needs_human_review ?? undefined,
    routingHints: routing ?? undefined,
    materializedObjectIds: row.materialized_object_ids ?? undefined,
    geminiInteractionId: row.gemini_interaction_id ?? undefined,
    createdAt: row.created_at,
  };
}

export interface InsertObservationParams {
  recordingKey: string;
  sessionId: string;
  category: ObservationCategory;
  title: string;
  body: string;
  sourceQuote?: string;
  sourceTimestamp?: string;
  changeType?: ObservationChangeType;
  canonicalKey?: string;
  supersedesId?: string;
  affectedEntityKeys?: string[];
  attributes?: Record<string, unknown>;
  geminiInteractionId?: string;
}

export async function insertObservations(
  items: InsertObservationParams[]
): Promise<RecordingObservation[]> {
  if (items.length === 0) return [];
  const rows: RecordingObservationRow[] = items.map((item) => ({
    id: generateObservationId(),
    recording_key: item.recordingKey,
    session_id: item.sessionId,
    category: item.category,
    title: item.title,
    body: item.body,
    source_quote: item.sourceQuote ?? null,
    source_timestamp: item.sourceTimestamp ?? null,
    change_type: item.changeType ?? "new",
    canonical_key: item.canonicalKey ?? null,
    supersedes_id: item.supersedesId ?? null,
    affected_entity_keys: item.affectedEntityKeys ?? [],
    attributes: item.attributes ?? {},
    importance: null,
    short_term_importance: null,
    confidence: null,
    novelty: null,
    update_existing: false,
    create_new: true,
    needs_follow_up: false,
    needs_reminder: false,
    needs_human_review: false,
    routing_hints: {},
    embedding: null,
    embedding_model: null,
    materialized_object_ids: [],
    gemini_interaction_id: item.geminiInteractionId ?? null,
    created_at: new Date().toISOString(),
  }));

  const { error } = await createUntypedAdminClient().from("recording_observations").insert(rows);
  if (error) throw error;
  return rows.map(rowToObservation);
}

export async function countObservationsForSession(sessionId: string): Promise<number> {
  const { count, error } = await createUntypedAdminClient()
    .from("recording_observations")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteObservationsForSession(sessionId: string): Promise<void> {
  const { error } = await createUntypedAdminClient()
    .from("recording_observations")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw error;
}

export async function getObservationsBySession(sessionId: string): Promise<RecordingObservation[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_observations")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RecordingObservationRow[]).map(rowToObservation);
}

export async function getPriorObservationsForContext(
  recordingKey: string,
  limit = 40
): Promise<RecordingObservation[]> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_observations")
    .select("*")
    .eq("recording_key", recordingKey)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as RecordingObservationRow[]).map(rowToObservation);
}

export async function findPriorObservationByCanonicalKey(
  recordingKey: string,
  canonicalKey: string
): Promise<RecordingObservation | null> {
  const { data, error } = await createUntypedAdminClient()
    .from("recording_observations")
    .select("*")
    .eq("recording_key", recordingKey)
    .eq("canonical_key", canonicalKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToObservation(data as RecordingObservationRow) : null;
}

export interface SignificanceUpdate {
  id: string;
  importance: number;
  shortTermImportance: number;
  confidence: number;
  novelty: number;
  updateExisting: boolean;
  createNew: boolean;
  needsFollowUp: boolean;
  needsReminder: boolean;
  needsHumanReview: boolean;
  routingHints: ObservationRoutingHints;
}

export async function updateObservationSignificance(
  updates: SignificanceUpdate[]
): Promise<void> {
  for (const u of updates) {
    const { error } = await createUntypedAdminClient()
      .from("recording_observations")
      .update({
        importance: u.importance,
        short_term_importance: u.shortTermImportance,
        confidence: u.confidence,
        novelty: u.novelty,
        update_existing: u.updateExisting,
        create_new: u.createNew,
        needs_follow_up: u.needsFollowUp,
        needs_reminder: u.needsReminder,
        needs_human_review: u.needsHumanReview,
        routing_hints: u.routingHints,
      })
      .eq("id", u.id);
    if (error) throw error;
  }
}

export async function markObservationsMaterialized(
  observationIds: string[],
  objectIds: string[]
): Promise<void> {
  if (observationIds.length === 0 || objectIds.length === 0) return;
  for (const obsId of observationIds) {
    const { data, error: fetchError } = await createUntypedAdminClient()
      .from("recording_observations")
      .select("materialized_object_ids")
      .eq("id", obsId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const existing = (data?.materialized_object_ids as string[] | null) ?? [];
    const merged = [...new Set([...existing, ...objectIds])];
    const { error } = await createUntypedAdminClient()
      .from("recording_observations")
      .update({ materialized_object_ids: merged })
      .eq("id", obsId);
    if (error) throw error;
  }
}

export async function searchObservationsDb(params: {
  recordingKey: string;
  query?: string;
  category?: ObservationCategory;
  sessionId?: string;
  limit?: number;
}): Promise<RecordingObservation[]> {
  let q = createUntypedAdminClient()
    .from("recording_observations")
    .select("*")
    .eq("recording_key", params.recordingKey)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.sessionId) q = q.eq("session_id", params.sessionId);
  if (params.category) q = q.eq("category", params.category);

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as RecordingObservationRow[];

  if (params.query?.trim()) {
    const term = params.query.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(term) ||
        row.body.toLowerCase().includes(term) ||
        (row.source_quote?.toLowerCase().includes(term) ?? false)
    );
  }

  return rows.slice(0, params.limit ?? 20).map(rowToObservation);
}

export function formatObservationsForPrompt(observations: RecordingObservation[]): string {
  if (observations.length === 0) return "No observations.";
  return observations
    .map((o) => {
      const scores =
        o.importance != null
          ? ` [importance=${o.importance.toFixed(2)}, novelty=${o.novelty?.toFixed(2) ?? "?"}]`
          : "";
      const flags = [
        o.needsReminder ? "needs_reminder" : null,
        o.needsFollowUp ? "needs_follow_up" : null,
        o.updateExisting ? "update_existing" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const flagStr = flags ? ` flags: ${flags}` : "";
      return `- [${o.id}] (${o.category}) ${o.title}: ${o.body}${scores}${flagStr}${
        o.sourceQuote ? `\n  quote: "${o.sourceQuote.slice(0, 200)}"` : ""
      }`;
    })
    .join("\n");
}

export function deriveSearchQueriesFromObservations(
  observations: RecordingObservation[]
): string[] {
  const queries = new Set<string>();
  for (const o of observations) {
    if (o.canonicalKey) queries.add(o.canonicalKey);
    for (const key of o.affectedEntityKeys ?? []) queries.add(key);
    if (o.title.length > 2) queries.add(o.title);
  }
  return [...queries].slice(0, 8);
}

export function deriveAgentsFromObservations(
  observations: RecordingObservation[]
): AgentName[] {
  const agents = new Set<AgentName>();
  for (const o of observations) {
    for (const a of o.routingHints?.agents ?? []) agents.add(a);
  }
  if (agents.size === 0) {
    for (const o of observations) {
      if (["person", "relationship", "organization", "location"].includes(o.category)) {
        agents.add("entity");
      }
      if (["event", "timeline"].includes(o.category)) agents.add("timeline");
      if (o.needsReminder || o.category === "commitment") agents.add("task");
      if (["change", "preference", "trend"].includes(o.category)) agents.add("memory");
    }
  }
  if (agents.size === 0) agents.add("entity");
  return [...agents];
}
