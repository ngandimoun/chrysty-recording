import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import { getFileSearchStore } from "@/lib/db/queries";

export interface MemoryStoreHit {
  text: string;
  title?: string;
  sessionId?: string;
  documentName?: string;
}

function sessionIdFromMetadata(
  metadata: Array<{ key?: string; stringValue?: string }> | undefined
): string | undefined {
  if (!metadata) return undefined;
  const entry = metadata.find((m) => m.key === "session_id");
  return entry?.stringValue;
}

function extractHitsFromResponse(response: {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        retrievedContext?: {
          text?: string;
          title?: string;
          documentName?: string;
          customMetadata?: Array<{ key?: string; stringValue?: string }>;
        };
      }>;
    };
  }>;
}): MemoryStoreHit[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const hits: MemoryStoreHit[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const ctx = chunk.retrievedContext;
    const text = ctx?.text?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    hits.push({
      text,
      title: ctx?.title,
      sessionId: sessionIdFromMetadata(ctx?.customMetadata),
      documentName: ctx?.documentName,
    });
  }

  return hits;
}

/**
 * Semantic search over indexed transcripts in the workspace File Search store.
 * Returns empty when no store exists or indexing has not completed yet.
 */
export async function searchMemoryStore(params: {
  recordingKey: string;
  query: string;
  topK?: number;
  metadataFilter?: string;
}): Promise<MemoryStoreHit[]> {
  const store = await getFileSearchStore(params.recordingKey);
  if (!store?.gemini_store_name) return [];

  const query = params.query.trim();
  if (!query) return [];

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: GEMINI_MODELS.background,
      contents: `Find transcript excerpts relevant to: ${query}`,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [store.gemini_store_name],
              topK: params.topK ?? 5,
              metadataFilter: params.metadataFilter,
            },
          },
        ],
      },
    });

    return extractHitsFromResponse(response);
  } catch (err) {
    console.warn("[memory-store] search failed:", err);
    return [];
  }
}
