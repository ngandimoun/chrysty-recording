import type { ChrystyDocument, DocumentBlock, DocumentType } from "@/lib/presentation/schema/document";
import { contentMayContainEmbeddedJson, looksLikeJsonFragment } from "@/lib/presentation/json-fragment";

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^---+\s*$/gm, "")
    .trim();
}

function linesToParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(stripMarkdown)
    .filter(Boolean);
}

export function markdownToDocument(
  markdown: string,
  title: string,
  documentType: DocumentType = "generic"
): ChrystyDocument {
  const cleaned = stripMarkdown(markdown);
  const paragraphs = linesToParagraphs(cleaned);

  const blocks: DocumentBlock[] = [];
  if (paragraphs.length > 0) {
    blocks.push({
      type: "summary",
      paragraphs: paragraphs.slice(0, 3),
    });
    for (const p of paragraphs.slice(3)) {
      blocks.push({ type: "paragraph", text: p });
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", text: cleaned || "No content yet." });
  }

  return {
    schemaVersion: 1,
    documentType,
    title,
    blocks,
  };
}

export function legacyContentToDocument(
  content: string | undefined,
  title: string,
  documentType: DocumentType = "generic"
): ChrystyDocument | null {
  if (!content?.trim()) return null;
  if (contentMayContainEmbeddedJson(content) || looksLikeJsonFragment(content)) return null;
  return markdownToDocument(content, title, documentType);
}
