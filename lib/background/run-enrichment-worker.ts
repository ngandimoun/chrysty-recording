import { getGeminiClient } from "@/lib/gemini/client";
import { EMBEDDING_MODEL, GEMINI_MODELS } from "@/lib/gemini/models";
import { chrystyDocumentJsonSchema } from "@/lib/presentation/schema/gemini-schemas";
import {
  parseChrystyDocumentJson,
} from "@/lib/presentation/schema/document";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { presentationDocumentToPlainText } from "@/lib/presentation/to-plain-text";
import { miniRecommendationDocument } from "@/lib/presentation/helpers/answer-document";
import {
  buildSessionGenerationContext,
  formatSessionContextForPrompt,
} from "@/lib/processing/session-context";
import {
  dedupePendingAttentionItems,
  getFileSearchStore,
  getKnowledgeObjectRowsForRecordingKey,
  getPendingEnrichmentJobs,
  getSession,
  getSessionForRecordingKey,
  getSessionChanges,
  insertKnowledgeEdge,
  insertRecommendation,
  markInsightsStale,
  saveFileSearchStore,
  searchKnowledgeObjectsDb,
  updateEnrichmentJob,
  updateSession,
  upsertMemoryDocument,
} from "@/lib/db/queries";

async function enrichmentContextBlock(sessionId: string, recordingKey: string): Promise<string> {
  const session = await getSessionForRecordingKey(recordingKey, sessionId);
  if (!session) return "";
  const ctx = buildSessionGenerationContext(session);
  return `\n${formatSessionContextForPrompt(ctx)}`;
}

async function pollOperation(operation: unknown): Promise<{ documentName?: string } | null> {
  const client = getGeminiClient();
  let op = operation as {
    done?: boolean;
    name?: string;
    response?: { documentName?: string };
  };
  let attempts = 0;
  while (!op.done && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    if (!op.name) break;
    const next = await client.operations.get({
      operation: op as Parameters<typeof client.operations.get>[0]["operation"],
    });
    op = next as {
      done?: boolean;
      name?: string;
      response?: { documentName?: string };
    };
    attempts++;
  }
  return op.done ? { documentName: op.response?.documentName } : null;
}

async function ensureFileSearchStore(recordingKey: string): Promise<string | null> {
  try {
    const existing = await getFileSearchStore(recordingKey);
    if (existing?.gemini_store_name) return existing.gemini_store_name;

    const client = getGeminiClient();
    const store = await client.fileSearchStores.create({
      config: {
        displayName: `recording-${recordingKey.slice(0, 20)}`,
        embeddingModel: `models/${EMBEDDING_MODEL}`,
      },
    });
    if (store.name) {
      await saveFileSearchStore(recordingKey, store.name);
      return store.name;
    }
  } catch (err) {
    console.warn("[enrichment] File Search store creation failed:", err);
  }
  return null;
}

async function indexSessionMemory(sessionId: string, recordingKey: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session?.transcript) return;

  const storeName = await ensureFileSearchStore(recordingKey);
  if (!storeName) return;

  try {
    const client = getGeminiClient();
    const { writeFile, unlink } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const tmpPath = join(tmpdir(), `chrysty-transcript-${sessionId}.txt`);
    await writeFile(tmpPath, session.transcript, "utf8");

    try {
      const operation = await client.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName,
        file: tmpPath,
        config: {
          displayName: `transcript-${sessionId}`,
          customMetadata: [
            { key: "session_id", stringValue: sessionId },
            { key: "type", stringValue: "transcript" },
          ],
        },
      });
      const completed = await pollOperation(operation);
      await upsertMemoryDocument({
        recordingKey,
        sourceType: "transcript",
        sourceId: sessionId,
        geminiDocumentName: completed?.documentName,
      });
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    console.warn("[enrichment] Transcript indexing failed:", err);
  }
}

async function updateKnowledgeGraph(sessionId: string, recordingKey: string): Promise<void> {
  const rows = await getKnowledgeObjectRowsForRecordingKey(recordingKey);
  const sessionObjects = rows.filter((r) => r.source_recording_id === sessionId);
  for (const obj of sessionObjects) {
    const related = obj.related_object_ids;
    if (!Array.isArray(related)) continue;
    for (const relatedId of related) {
      try {
        await insertKnowledgeEdge({
          recordingKey,
          fromObjectId: obj.id,
          toObjectId: relatedId,
          relationType: "related_to",
          sourceRecordingId: sessionId,
        });
      } catch {
        /* duplicate edge ok */
      }
    }
  }
}

const RECOMMENDATION_DOC_PROMPT = `Output structured JSON (Document DSL). documentType: generic. Short title and 1-2 summary paragraphs. Plain text only — no markdown.`;

function parseRecommendationDocument(
  text: string,
  fallbackTitle: string,
  fallbackBody: string
): { title: string; body: string; document: ReturnType<typeof prepareDocument> } {
  try {
    const doc = prepareDocument(parseChrystyDocumentJson(text));
    return {
      title: doc.title,
      body: presentationDocumentToPlainText(doc),
      document: doc,
    };
  } catch {
    const doc = prepareDocument(miniRecommendationDocument(fallbackTitle, fallbackBody));
    return { title: fallbackTitle, body: fallbackBody, document: doc };
  }
}

async function saveRecommendationFromInteraction(
  text: string,
  recordingKey: string,
  patternKey: string,
  sessionId: string,
  fallbackTitle: string,
  fallbackBody: string
): Promise<void> {
  const parsed = parseRecommendationDocument(text, fallbackTitle, fallbackBody);
  await insertRecommendation({
    recordingKey,
    title: parsed.title,
    body: parsed.body,
    patternKey,
    sourceRecordingId: sessionId,
    presentationDocument: parsed.document as unknown as Record<string, unknown>,
  });
}

async function generateRecommendations(sessionId: string, recordingKey: string): Promise<void> {
  const people = await searchKnowledgeObjectsDb({ recordingKey, type: "person", limit: 50 });
  const topics = await searchKnowledgeObjectsDb({ recordingKey, type: "idea", limit: 50 });

  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.title, (counts.get(p.title) ?? 0) + (p.mentionCount ?? 1));

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const contextBlock = await enrichmentContextBlock(sessionId, recordingKey);
  if (top && top[1] >= 5) {
    const client = getGeminiClient();
    try {
      const interaction = await client.interactions.create({
        model: GEMINI_MODELS.background,
        input: `User mentioned "${top[0]}" ${top[1]} times across voice recordings. Suggest one proactive insight.${contextBlock}`,
        system_instruction: RECOMMENDATION_DOC_PROMPT,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: chrystyDocumentJsonSchema,
        },
        store: false,
      });
      const text = interaction.output_text?.trim();
      if (text) {
        await saveRecommendationFromInteraction(
          text,
          recordingKey,
          `frequent_person:${top[0].toLowerCase()}`,
          sessionId,
          `About ${top[0]}`,
          `You mention ${top[0]} often — consider a dedicated follow-up.`
        );
      }
    } catch {
      /* best-effort */
    }
  }

  if (topics.length >= 10) {
    const topTopics = topics.slice(0, 5).map((t) => t.title).join(", ");
    const client = getGeminiClient();
    try {
      const interaction = await client.interactions.create({
        model: GEMINI_MODELS.background,
        input: `Recurring topics in voice notes: ${topTopics}. Suggest one insight or next step.${contextBlock}`,
        system_instruction: RECOMMENDATION_DOC_PROMPT,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: chrystyDocumentJsonSchema,
        },
        store: false,
      });
      const text = interaction.output_text?.trim();
      if (text) {
        await saveRecommendationFromInteraction(
          text,
          recordingKey,
          "topic_pattern",
          sessionId,
          "Topic pattern",
          `Recurring themes: ${topTopics}`
        );
      }
    } catch {
      /* best-effort */
    }
  }
}

async function runCrossAnalysis(sessionId: string, recordingKey: string): Promise<void> {
  const changes = await getSessionChanges(recordingKey, sessionId);
  const sessionObjects = (await getKnowledgeObjectRowsForRecordingKey(recordingKey)).filter(
    (r) => r.source_recording_id === sessionId
  );

  if (changes.length === 0 && sessionObjects.length === 0) return;

  const changeLines = changes
    .slice(0, 8)
    .map((c) => `- ${c.fieldName}: ${c.previousValue ?? "(none)"} → ${c.newValue}`);
  const entityLines = sessionObjects
    .slice(0, 10)
    .map((o) => `- [${o.type}] ${o.title}`);

  const client = getGeminiClient();
  const contextBlock = await enrichmentContextBlock(sessionId, recordingKey);
  try {
    const interaction = await client.interactions.create({
      model: GEMINI_MODELS.background,
      input: `Summarize what changed in this voice recording session for the user's insights dashboard.

New/updated entities:
${entityLines.join("\n") || "(none)"}

Field changes:
${changeLines.join("\n") || "(none)"}${contextBlock}`,
      system_instruction: RECOMMENDATION_DOC_PROMPT,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: chrystyDocumentJsonSchema,
      },
      store: false,
    });
    const text = interaction.output_text?.trim();
    if (text) {
      await saveRecommendationFromInteraction(
        text,
        recordingKey,
        "cross_analysis",
        sessionId,
        "Session changes",
        "Updates from your latest recording."
      );
    }
  } catch {
    /* best-effort */
  }
}

async function runEmbedObservations(sessionId: string): Promise<void> {
  const { getObservationsBySession } = await import("@/lib/db/observations");
  const observations = await getObservationsBySession(sessionId);
  if (observations.length === 0) return;
  // Embedding index deferred — observations are keyword-searchable; vector index when pgvector is enabled.
  console.info(`[enrichment] ${observations.length} observations ready for session ${sessionId}`);
}

async function runMemoryCleanup(recordingKey: string): Promise<void> {
  const removed = await dedupePendingAttentionItems(recordingKey);
  if (removed > 0) {
    console.info(`[enrichment] Removed ${removed} duplicate pending attention items`);
  }
}

async function runJob(
  job: { id: string; job_type: string; attempts?: number },
  sessionId: string,
  recordingKey: string
): Promise<void> {
  await updateEnrichmentJob(job.id, {
    status: "running",
    started_at: new Date().toISOString(),
    attempts: (job.attempts ?? 0) + 1,
  });

  try {
    switch (job.job_type) {
      case "index_memory":
        await indexSessionMemory(sessionId, recordingKey);
        break;
      case "update_graph":
        await updateKnowledgeGraph(sessionId, recordingKey);
        break;
      case "mark_insights_stale":
        await markInsightsStale(recordingKey);
        break;
      case "recommendations":
        await generateRecommendations(sessionId, recordingKey);
        break;
      case "cross_analysis":
        await runCrossAnalysis(sessionId, recordingKey);
        break;
      case "memory_cleanup":
        await runMemoryCleanup(recordingKey);
        break;
      case "embed_observations":
        await runEmbedObservations(sessionId);
        break;
      default:
        break;
    }
    await updateEnrichmentJob(job.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    await updateEnrichmentJob(job.id, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    });
  }
}

export async function runBackgroundEnrichment(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session?.recording_key) return;

  await updateSession(sessionId, { enrichment_status: "running" });

  const jobs = await getPendingEnrichmentJobs(sessionId);
  for (const job of jobs) {
    await runJob(
      job as { id: string; job_type: string; attempts?: number },
      sessionId,
      session.recording_key
    );
  }

  await updateSession(sessionId, { enrichment_status: "done" });
}
