import { normalizeDueAt } from "@/lib/dates/normalize-due-at";
import { toCanonicalKey } from "@/lib/agents/canonical-key";
import {
  getKnowledgeObjectByCanonicalKey,
  getKnowledgeObjectDb,
  getLatestDocumentVersionNumber,
  getRecordingSummaryDb,
  insertKnowledgeEdge,
  insertKnowledgeObject,
  insertKnowledgeObjectVersion,
  linkRelatedObjects,
  listAttentionItemsDb,
  recordKnowledgeChange,
  searchKnowledgeObjectsDb,
  searchTranscriptsDb,
  updateKnowledgeObjectDb,
  updateKnowledgeObjectFields,
  updateKnowledgeObjectPreview,
} from "@/lib/db/queries";
import { searchMemoryStore } from "@/lib/gemini/search-memory-store";
import { searchObservationsDb } from "@/lib/db/observations";
import { recordRecallObservation } from "@/lib/memory/reevaluation";
import type { AttentionStatus, KnowledgeObjectType } from "@/types";

export interface ToolHandlerContext {
  sessionId?: string;
  recordingKey?: string;
  clientTimezone?: string;
  savedObjectIds?: string[];
  documentMeta?: Map<string, { docType: string; objectId: string; updateExisting?: boolean }>;
}

export async function executeToolHandler(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolHandlerContext
): Promise<unknown> {
  switch (name) {
    case "save_attention_item": {
      if (!ctx.sessionId) throw new Error("sessionId required");
      const dueAt = normalizeDueAt(args.dueAt, { timezone: ctx.clientTimezone });
      const obj = await insertKnowledgeObject({
        type: "attention",
        title: String(args.title),
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        sourceQuote: args.sourceQuote ? String(args.sourceQuote) : undefined,
        status: args.status as AttentionStatus | undefined,
        dueAt,
        sourceRecordingId: ctx.sessionId,
        canonicalKey: toCanonicalKey(String(args.title)),
      });
      ctx.savedObjectIds?.push(obj.id);
      return { success: true, id: obj.id, title: obj.title };
    }
    case "update_attention_item": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const dueAt =
        args.dueAt !== undefined
          ? normalizeDueAt(args.dueAt, { timezone: ctx.clientTimezone })
          : undefined;
      const updated = await updateKnowledgeObjectDb(ctx.recordingKey, String(args.id), {
        title: args.title ? String(args.title) : undefined,
        subtitle: args.subtitle !== undefined ? String(args.subtitle) : undefined,
        status: args.status as AttentionStatus | undefined,
        dueAt,
      });
      return updated ? { success: true, id: updated.id } : { error: "Not found" };
    }
    case "save_person":
      return saveTypedObject("person", args, ctx);
    case "save_place":
      return saveTypedObject("place", args, ctx);
    case "save_company":
      return saveTypedObject("company", args, ctx);
    case "save_event":
      return saveTypedObject("event", args, ctx);
    case "save_idea":
      return saveTypedObject("idea", args, ctx);
    case "save_object":
      return saveTypedObject("object", args, ctx);
    case "save_document": {
      if (!ctx.sessionId) throw new Error("sessionId required");
      const title = String(args.title);
      const canonicalKey = toCanonicalKey(title);
      if (ctx.recordingKey) {
        const existing = await getKnowledgeObjectByCanonicalKey(ctx.recordingKey, canonicalKey);
        if (existing) {
          ctx.documentMeta?.set(existing.id, {
            docType: String(args.docType ?? args.title),
            objectId: existing.id,
            updateExisting: true,
          });
          return { success: true, id: existing.id, title: existing.title, existing: true };
        }
      }
      const obj = await insertKnowledgeObject({
        type: "document",
        title,
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        sourceQuote: args.sourceQuote ? String(args.sourceQuote) : undefined,
        sourceRecordingId: ctx.sessionId,
        canonicalKey,
      });
      ctx.savedObjectIds?.push(obj.id);
      ctx.documentMeta?.set(obj.id, {
        docType: String(args.docType ?? args.title),
        objectId: obj.id,
      });
      return { success: true, id: obj.id, title: obj.title };
    }
    case "resolve_entity": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const title = String(args.title);
      const key = args.canonicalKey
        ? String(args.canonicalKey)
        : toCanonicalKey(title);
      const byKey = await getKnowledgeObjectByCanonicalKey(ctx.recordingKey, key);
      if (byKey) {
        return { found: true, id: byKey.id, title: byKey.title, canonicalKey: key };
      }
      const results = await searchKnowledgeObjectsDb({
        recordingKey: ctx.recordingKey,
        query: title,
        type: args.type as KnowledgeObjectType | undefined,
        limit: 5,
      });
      const match = results.find(
        (r) => r.title.toLowerCase() === title.toLowerCase()
      );
      if (match) {
        return { found: true, id: match.id, title: match.title };
      }
      return { found: false, suggestedCanonicalKey: key };
    }
    case "create_knowledge_object": {
      if (!ctx.sessionId) throw new Error("sessionId required");
      const type = args.type as KnowledgeObjectType;
      const title = String(args.title);
      const obj = await insertKnowledgeObject({
        type,
        title,
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        sourceQuote: args.sourceQuote ? String(args.sourceQuote) : undefined,
        sourceRecordingId: ctx.sessionId,
        canonicalKey: args.canonicalKey
          ? String(args.canonicalKey)
          : toCanonicalKey(title),
        attributes: args.attributes as Record<string, unknown> | undefined,
      });
      ctx.savedObjectIds?.push(obj.id);
      if (type === "document") {
        ctx.documentMeta?.set(obj.id, {
          docType: title,
          objectId: obj.id,
        });
      }
      return { success: true, id: obj.id, title: obj.title };
    }
    case "update_knowledge_object": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const id = String(args.id);
      const existing = await getKnowledgeObjectDb(id, ctx.recordingKey);
      if (!existing) return { error: "Not found" };
      const mergedAttrs = {
        ...(existing.attributes ?? {}),
        ...((args.attributes as Record<string, unknown>) ?? {}),
      };
      await updateKnowledgeObjectFields(id, {
        title: args.title ? String(args.title) : undefined,
        subtitle: args.subtitle !== undefined ? String(args.subtitle) : undefined,
        mentionCount: (existing.mentionCount ?? 1) + 1,
        attributes: mergedAttrs,
      });
      ctx.savedObjectIds?.push(id);
      return { success: true, id, mentionCount: (existing.mentionCount ?? 1) + 1 };
    }
    case "update_document": {
      if (!ctx.sessionId || !ctx.recordingKey) throw new Error("sessionId and recordingKey required");
      const objectId = String(args.objectId);
      const content = String(args.content);
      const changeSummary = String(args.changeSummary);
      const presentationDocument = args.presentationDocument as Record<string, unknown> | undefined;
      const latest = await getLatestDocumentVersionNumber(objectId);
      const versionNumber = latest + 1;
      const versionId = await insertKnowledgeObjectVersion({
        objectId,
        versionNumber,
        content,
        changeSummary,
        sourceRecordingId: ctx.sessionId,
        presentationDocument,
      });
      const existing = await getKnowledgeObjectDb(objectId, ctx.recordingKey);
      const mergedAttributes = {
        ...(existing?.attributes ?? {}),
        ...(presentationDocument ? { presentationDocument } : {}),
      };
      await updateKnowledgeObjectFields(objectId, {
        previewContent: content,
        activeVersionId: versionId,
        attributes: mergedAttributes,
        ...(presentationDocument ? { presentationDocument } : {}),
      });
      return { success: true, objectId, versionNumber, versionId };
    }
    case "record_change": {
      if (!ctx.recordingKey || !ctx.sessionId) throw new Error("recordingKey and sessionId required");
      const id = await recordKnowledgeChange({
        recordingKey: ctx.recordingKey,
        objectId: args.objectId ? String(args.objectId) : undefined,
        fieldName: String(args.fieldName),
        previousValue: args.previousValue ? String(args.previousValue) : undefined,
        newValue: String(args.newValue),
        changeType: args.changeType ? String(args.changeType) : "update",
        sourceRecordingId: ctx.sessionId,
      });
      return { success: true, changeId: id };
    }
    case "link_entities": {
      if (!ctx.recordingKey || !ctx.sessionId) throw new Error("recordingKey and sessionId required");
      await insertKnowledgeEdge({
        recordingKey: ctx.recordingKey,
        fromObjectId: String(args.fromObjectId),
        toObjectId: String(args.toObjectId),
        relationType: String(args.relationType),
        sourceRecordingId: ctx.sessionId,
      });
      return { success: true };
    }
    case "link_related_objects": {
      await linkRelatedObjects(String(args.objectId), (args.relatedObjectIds as string[]) ?? []);
      return { success: true };
    }
    case "search_existing_objects": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const results = await searchKnowledgeObjectsDb({
        recordingKey: ctx.recordingKey,
        query: String(args.query),
        type: args.type as KnowledgeObjectType | undefined,
        limit: 10,
      });
      return {
        results: results.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          mentionCount: r.mentionCount,
          canonicalKey: r.canonicalKey,
        })),
      };
    }
    case "search_observations": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const results = await searchObservationsDb({
        recordingKey: ctx.recordingKey,
        query: args.query ? String(args.query) : undefined,
        category: args.category as import("@/lib/agents/observation-schema").ObservationCategory | undefined,
        sessionId: args.sessionId ? String(args.sessionId) : undefined,
        limit: typeof args.limit === "number" ? args.limit : 10,
      });
      return {
        results: results.map((r) => ({
          id: r.id,
          category: r.category,
          title: r.title,
          body: r.body,
          sourceQuote: r.sourceQuote,
          importance: r.importance,
          sessionId: r.sessionId,
          createdAt: r.createdAt,
        })),
      };
    }
    case "search_transcripts": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const query = String(args.query);
      const results = await searchTranscriptsDb(
        query,
        ctx.recordingKey,
        typeof args.limit === "number" ? args.limit : 5
      );
      recordRecallObservation({
        source: "keyword",
        query,
        hitCount: results.length,
        context: "voice_qa",
      });
      return { results };
    }
    case "search_memory_store": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const query = String(args.query);
      const hits = await searchMemoryStore({
        recordingKey: ctx.recordingKey,
        query,
        topK: typeof args.limit === "number" ? args.limit : 5,
      });
      recordRecallObservation({
        source: "file_search",
        query,
        hitCount: hits.length,
        context: "voice_qa",
      });
      return {
        results: hits.map((h) => ({
          sessionId: h.sessionId,
          title: h.title,
          excerpt: h.text.slice(0, 800),
        })),
      };
    }
    case "search_knowledge_objects": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const results = await searchKnowledgeObjectsDb({
        recordingKey: ctx.recordingKey,
        query: args.query ? String(args.query) : undefined,
        type: args.type as KnowledgeObjectType | undefined,
        limit: typeof args.limit === "number" ? args.limit : 20,
      });
      return { results };
    }
    case "get_knowledge_object": {
      const obj = await getKnowledgeObjectDb(String(args.id), ctx.recordingKey);
      return obj ?? { error: "Not found" };
    }
    case "list_attention_items": {
      if (!ctx.recordingKey) throw new Error("recordingKey required");
      const items = await listAttentionItemsDb(
        ctx.recordingKey,
        args.status as AttentionStatus | undefined
      );
      return { items };
    }
    case "get_recording_summary": {
      const summary = await getRecordingSummaryDb(String(args.sessionId), ctx.recordingKey);
      return summary ?? { error: "Not found" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function saveTypedObject(
  type: KnowledgeObjectType,
  args: Record<string, unknown>,
  ctx: ToolHandlerContext
) {
  if (!ctx.sessionId) throw new Error("sessionId required");
  const title = String(args.title);
  if (ctx.recordingKey) {
    const key = toCanonicalKey(title);
    const existing = await getKnowledgeObjectByCanonicalKey(ctx.recordingKey, key);
    if (existing) {
      await updateKnowledgeObjectFields(existing.id, {
        mentionCount: (existing.mentionCount ?? 1) + 1,
      });
      ctx.savedObjectIds?.push(existing.id);
      return { success: true, id: existing.id, title: existing.title, updated: true };
    }
  }
  const obj = await insertKnowledgeObject({
    type,
    title,
    subtitle: args.subtitle ? String(args.subtitle) : undefined,
    sourceQuote: args.sourceQuote ? String(args.sourceQuote) : undefined,
    sourceRecordingId: ctx.sessionId,
    canonicalKey: toCanonicalKey(title),
  });
  ctx.savedObjectIds?.push(obj.id);
  return { success: true, id: obj.id, title: obj.title };
}

export { updateKnowledgeObjectPreview };
