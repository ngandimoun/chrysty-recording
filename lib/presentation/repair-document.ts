import type { ChrystyDocument, DocumentBlock } from "@/lib/presentation/schema/document";
import { parseChrystyDocumentJson } from "@/lib/presentation/schema/document";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import {
  contentMayContainEmbeddedJson,
  isCorruptedPresentation,
  looksLikeJsonFragment,
} from "@/lib/presentation/json-fragment";

export {
  contentMayContainEmbeddedJson,
  isCorruptedPresentation,
  looksLikeJsonFragment,
} from "@/lib/presentation/json-fragment";

const JSON_MARKERS = ['"schemaVersion"', '"blocks"'] as const;

function textLooksLikeEmbeddedDocumentJson(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.includes(JSON_MARKERS[0]) &&
    trimmed.includes(JSON_MARKERS[1]) &&
    trimmed.includes("{")
  );
}

function blockText(block: DocumentBlock): string[] {
  switch (block.type) {
    case "summary":
      return block.paragraphs;
    case "paragraph":
    case "quote":
    case "callout":
    case "clause":
    case "code":
      return [block.text];
    default:
      return [];
  }
}

function allBlockText(doc: ChrystyDocument): string[] {
  return doc.blocks.flatMap((block) => blockText(block));
}

/** True when stored content embeds a ChrystyDocument JSON blob as plain text. */
export function documentContainsEmbeddedJson(doc: ChrystyDocument): boolean {
  for (const text of allBlockText(doc)) {
    if (textLooksLikeEmbeddedDocumentJson(text)) return true;
  }
  const joined = allBlockText(doc).join("");
  return textLooksLikeEmbeddedDocumentJson(joined);
}

/** True when the doc has real block structure, not a corrupted JSON wrapper. */
export function hasMeaningfulStructure(doc: ChrystyDocument): boolean {
  if (documentContainsEmbeddedJson(doc)) return false;

  const meaningfulTypes = new Set([
    "people",
    "companies",
    "checklist",
    "timeline",
    "decisions",
    "metrics",
    "table",
    "references",
    "imageGallery",
    "callout",
  ]);

  if (doc.blocks.some((b) => meaningfulTypes.has(b.type))) return true;
  if (doc.blocks.length >= 2) return true;

  const only = doc.blocks[0];
  if (!only) return false;
  if (only.type === "summary") {
    return only.paragraphs.some((p) => p.trim().length > 0 && !looksLikeJsonFragment(p));
  }
  return only.type === "paragraph" || only.type === "quote";
}

function shouldIncludeInRepairAssembly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Skip short label lines like "Attention Item" (no JSON characters)
  if (trimmed.length < 60 && !trimmed.includes("{") && !trimmed.includes('"')) return false;
  return true;
}

/** Concatenate block text for JSON reassembly (empty-string join, not paragraph breaks). */
export function collectRepairableText(
  doc: ChrystyDocument | null | undefined,
  previewContent?: string
): string {
  const parts: string[] = [];
  if (doc) {
    parts.push(...allBlockText(doc));
  }
  if (previewContent?.trim()) parts.push(previewContent.trim());

  const assembled = parts.filter(shouldIncludeInRepairAssembly).join("");
  if (contentMayContainEmbeddedJson(assembled)) return assembled;

  return parts.join("");
}

export function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/im, "")
    .replace(/\n?```\s*$/im, "")
    .trim();
}

export function extractJsonSlice(text: string): string | null {
  const cleaned = stripMarkdownCodeFences(text);
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
  return cleaned.slice(jsonStart, jsonEnd + 1);
}

/** Collapse unescaped newlines Gemini often inserts inside JSON string values. */
export function sanitizeLooseJson(slice: string): string {
  return slice.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

export function tryRepairEmbeddedDocument(text: string): ChrystyDocument | null {
  const slice = extractJsonSlice(text);
  if (!slice) return null;

  try {
    return prepareDocument(parseChrystyDocumentJson(sanitizeLooseJson(slice)));
  } catch {
    try {
      return prepareDocument(parseChrystyDocumentJson(slice));
    } catch {
      try {
        return prepareDocument(parseChrystyDocumentJson(text));
      } catch {
        return null;
      }
    }
  }
}

export function tryRepairStoredPresentation(
  stored: ChrystyDocument | null,
  previewContent?: string
): ChrystyDocument | null {
  if (!isCorruptedPresentation(stored, previewContent)) return null;

  const repaired = tryRepairEmbeddedDocument(collectRepairableText(stored, previewContent));
  if (!repaired || documentContainsEmbeddedJson(repaired)) return null;
  return repaired;
}
