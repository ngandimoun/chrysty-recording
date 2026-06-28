import {
  getKnowledgeObjectByCanonicalKey,
  getKnowledgeObjectRowsForRecordingKey,
  searchKnowledgeObjectsDb,
  searchTranscriptsDb,
} from "@/lib/db/queries";
import { getPriorObservationsForContext } from "@/lib/db/observations";
import type { RetrievedContext } from "@/lib/agents/types";
import type { QuickPlan } from "@/lib/agents/types";
import { searchMemoryStore } from "@/lib/gemini/search-memory-store";
import { recordRecallObservation } from "@/lib/memory/reevaluation";

function extractKeywordsFromText(text: string): string[] {
  const queries: string[] = [];
  const names = text.match(/\b[A-Z][a-z]{2,15}\b/g);
  if (names) queries.push(...names.slice(0, 3));
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  queries.push(...words.slice(0, 3));
  return [...new Set(queries)].slice(0, 5);
}

/** Broad context retrieval before observation — not plan-specific. */
export async function retrievePriorWorld(
  recordingKey: string,
  currentSessionId: string,
  transcriptSummary: string,
  flatTranscript: string
): Promise<RetrievedContext> {
  const keywords = extractKeywordsFromText(`${transcriptSummary}\n${flatTranscript.slice(0, 500)}`);
  const plan: QuickPlan = {
    recordingClass: "full",
    agents: ["entity", "memory", "timeline"],
    searchQueries: keywords,
  };
  const ctx = await retrieveLightweightContext(recordingKey, plan, currentSessionId);
  const priorObservations = await getPriorObservationsForContext(recordingKey, 40);
  return { ...ctx, priorObservations };
}

export async function retrieveLightweightContext(
  recordingKey: string,
  plan: QuickPlan,
  currentSessionId: string
): Promise<RetrievedContext> {
  const queries = plan.searchQueries?.length
    ? plan.searchQueries
    : (plan.affectedCanonicalKeys ?? []);

  const relatedObjects = [];
  const seenIds = new Set<string>();

  for (const query of queries.slice(0, 5)) {
    const results = await searchKnowledgeObjectsDb({
      recordingKey,
      query,
      limit: 8,
    });
    recordRecallObservation({
      source: "keyword",
      query,
      hitCount: results.length,
      context: "extraction",
    });
    for (const obj of results) {
      if (!seenIds.has(obj.id)) {
        seenIds.add(obj.id);
        relatedObjects.push(obj);
      }
    }
  }

  for (const key of plan.affectedCanonicalKeys ?? []) {
    const obj = await getKnowledgeObjectByCanonicalKey(recordingKey, key);
    if (obj && !seenIds.has(obj.id)) {
      seenIds.add(obj.id);
      relatedObjects.push(obj);
    }
  }

  if (relatedObjects.length === 0) {
    const recent = await searchKnowledgeObjectsDb({ recordingKey, limit: 10 });
    for (const obj of recent) {
      if (!seenIds.has(obj.id)) {
        seenIds.add(obj.id);
        relatedObjects.push(obj);
      }
    }
  }

  const priorTranscripts = [];
  for (const query of queries.slice(0, 3)) {
    const hits = await searchTranscriptsDb(query, recordingKey, 3);
    for (const hit of hits) {
      if ((hit.id as string) === currentSessionId) continue;
      priorTranscripts.push({
        sessionId: hit.id as string,
        excerpt: ((hit.transcript as string) ?? "").slice(0, 500),
        createdAt: hit.created_at as string,
      });
    }
  }

  const memoryExcerpts: RetrievedContext["memoryExcerpts"] = [];
  const seenMemory = new Set<string>();
  for (const query of queries.slice(0, 3)) {
    const hits = await searchMemoryStore({ recordingKey, query, topK: 3 });
    recordRecallObservation({
      source: "file_search",
      query,
      hitCount: hits.length,
      context: "extraction",
    });
    for (const hit of hits) {
      if (hit.sessionId === currentSessionId) continue;
      const excerpt = hit.text.slice(0, 500);
      if (seenMemory.has(excerpt)) continue;
      seenMemory.add(excerpt);
      memoryExcerpts.push({
        sessionId: hit.sessionId,
        excerpt,
        title: hit.title,
      });
    }
  }

  const allRows = await getKnowledgeObjectRowsForRecordingKey(recordingKey);
  const existingDocuments = allRows
    .filter((r) => r.type === "document")
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      title: r.title,
      canonicalKey: r.canonical_key ?? undefined,
      previewContent: r.preview_content?.slice(0, 2000) ?? undefined,
      presentationDocument:
        (r.attributes?.presentationDocument as RetrievedContext["existingDocuments"][0]["presentationDocument"]) ??
        undefined,
    }));

  const priorObservations = await getPriorObservationsForContext(recordingKey, 20);

  return { priorTranscripts, memoryExcerpts, relatedObjects, existingDocuments, priorObservations };
}

export function formatRetrievedContextForPrompt(ctx: RetrievedContext): string {
  const parts: string[] = [];

  if (ctx.priorObservations.length > 0) {
    parts.push(
      "Prior observations:",
      ...ctx.priorObservations.slice(0, 15).map(
        (o) => `- [${o.category}] ${o.title}: ${o.body.slice(0, 150)}`
      )
    );
  }

  if (ctx.relatedObjects.length > 0) {
    parts.push(
      "Existing knowledge objects:",
      ...ctx.relatedObjects.map(
        (o) =>
          `- [${o.type}] ${o.title} (id: ${o.id}${o.mentionCount ? `, mentions: ${o.mentionCount}` : ""})`
      )
    );
  }

  if (ctx.existingDocuments.length > 0) {
    parts.push(
      "Existing documents (UPDATE these instead of creating duplicates):",
      ...ctx.existingDocuments.map(
        (d) => `- ${d.title} (id: ${d.id}${d.canonicalKey ? `, key: ${d.canonicalKey}` : ""})`
      )
    );
  }

  if (ctx.memoryExcerpts.length > 0) {
    parts.push(
      "Semantically matched prior transcript excerpts (File Search):",
      ...ctx.memoryExcerpts.map(
        (t) =>
          `- ${t.sessionId ? `Session ${t.sessionId}` : "Prior session"}${t.title ? ` (${t.title})` : ""}: ${t.excerpt.slice(0, 300)}…`
      )
    );
  }

  if (ctx.priorTranscripts.length > 0) {
    parts.push(
      "Prior session excerpts (keyword match):",
      ...ctx.priorTranscripts.map(
        (t) =>
          `- Session ${t.sessionId}${t.createdAt ? ` (${t.createdAt})` : ""}: ${t.excerpt.slice(0, 300)}…`
      )
    );
  }

  return parts.length > 0 ? parts.join("\n") : "No prior context found — this may be a first recording.";
}
