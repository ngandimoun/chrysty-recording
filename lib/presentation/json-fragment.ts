import type { ChrystyDocument } from "@/lib/presentation/schema/document";

const JSON_MARKERS = ['"schemaVersion"', '"blocks"'] as const;

export function looksLikeJsonFragment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    trimmed.includes(JSON_MARKERS[0]) ||
    trimmed.includes(JSON_MARKERS[1]) ||
    (trimmed.includes('"type"') && trimmed.includes('": "'))
  );
}

export function contentMayContainEmbeddedJson(text: string): boolean {
  return (
    text.includes("{") &&
    text.includes(JSON_MARKERS[0]) &&
    text.includes(JSON_MARKERS[1])
  );
}

function blockTexts(doc: ChrystyDocument): string[] {
  const texts: string[] = [];
  for (const block of doc.blocks) {
    switch (block.type) {
      case "summary":
        texts.push(...block.paragraphs);
        break;
      case "paragraph":
      case "quote":
      case "callout":
      case "clause":
      case "code":
        texts.push(block.text);
        break;
      default:
        break;
    }
  }
  return texts;
}

function storedDocContainsEmbeddedJson(doc: ChrystyDocument): boolean {
  const texts = blockTexts(doc);
  for (const text of texts) {
    const trimmed = text.trim();
    if (
      trimmed.includes(JSON_MARKERS[0]) &&
      trimmed.includes(JSON_MARKERS[1]) &&
      trimmed.includes("{")
    ) {
      return true;
    }
  }
  const joined = texts.join("");
  return (
    joined.includes(JSON_MARKERS[0]) &&
    joined.includes(JSON_MARKERS[1]) &&
    joined.includes("{")
  );
}

/** True when stored or preview content embeds JSON as plain text instead of structured blocks. */
export function isCorruptedPresentation(
  stored?: ChrystyDocument | null,
  previewContent?: string | null
): boolean {
  if (previewContent?.trim()) {
    if (contentMayContainEmbeddedJson(previewContent)) return true;
    if (looksLikeJsonFragment(previewContent)) return true;
  }

  if (!stored) return false;

  if (storedDocContainsEmbeddedJson(stored)) return true;

  const texts = blockTexts(stored);
  if (texts.some((t) => t.trim().startsWith("{"))) return true;

  const joined = texts.join("");
  return looksLikeJsonFragment(joined);
}
