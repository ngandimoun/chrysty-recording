import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import { legacyContentToDocument } from "@/lib/presentation/migrate/markdown-fallback";

export function textToAnswerDocument(text: string, question?: string): ChrystyDocument {
  const title = question?.trim() ? "Answer" : "Insight";
  const legacy = legacyContentToDocument(text, title, "generic");
  return (
    legacy ?? {
      schemaVersion: 1,
      documentType: "generic",
      title,
      blocks: [{ type: "paragraph", text: text || "No answer found." }],
    }
  );
}

export function miniRecommendationDocument(title: string, body: string): ChrystyDocument {
  return {
    schemaVersion: 1,
    documentType: "generic",
    title,
    blocks: [
      {
        type: "summary",
        paragraphs: body.split(/\n{2,}/).filter(Boolean).slice(0, 3),
      },
    ],
  };
}

export function parseRecommendationDocument(raw: unknown, title: string, body: string): ChrystyDocument {
  if (raw && typeof raw === "object" && "schemaVersion" in raw && "blocks" in raw) {
    return raw as ChrystyDocument;
  }
  return miniRecommendationDocument(title, body);
}
