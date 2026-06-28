import type { ChrystyDocument, DocumentBlock } from "@/lib/presentation/schema/document";
import { splitLongParagraph } from "@/lib/presentation/enrich/split-paragraphs";
import { looksLikeJsonFragment } from "@/lib/presentation/json-fragment";

const META_PATTERNS = [
  /^here'?s your (summary|report|document)/i,
  /^as an ai/i,
  /^i'?ve (prepared|created|generated)/i,
];

function stripMeta(text: string): string {
  let result = text.trim();
  for (const pattern of META_PATTERNS) {
    result = result.replace(pattern, "").trim();
  }
  return result;
}

function enrichBlock(block: DocumentBlock): DocumentBlock[] {
  switch (block.type) {
    case "summary":
      return [
        {
          type: "summary",
          paragraphs: block.paragraphs.flatMap((p) =>
            looksLikeJsonFragment(p) ? [p] : splitLongParagraph(stripMeta(p))
          ),
        },
      ];
    case "paragraph":
      if (looksLikeJsonFragment(block.text)) {
        return [{ type: "paragraph" as const, text: block.text }];
      }
      return splitLongParagraph(stripMeta(block.text)).map((text) => ({
        type: "paragraph" as const,
        text,
      }));
    case "checklist":
      return [block];
    case "quote":
      return [{ ...block, text: stripMeta(block.text) }];
    case "callout":
      return [{ ...block, text: stripMeta(block.text) }];
    case "clause":
      return splitLongParagraph(stripMeta(block.text)).map((text) => ({
        type: "clause" as const,
        text,
      }));
    default:
      return [block];
  }
}

/** Promote action-like paragraphs into checklist items when adjacent to none. */
function promoteActions(blocks: DocumentBlock[]): DocumentBlock[] {
  const actionPattern =
    /\b(will|should|must|need to|contact|call|email|approve|review|schedule|send)\b/i;
  const result: DocumentBlock[] = [];

  for (const block of blocks) {
    if (block.type === "paragraph" && looksLikeJsonFragment(block.text)) {
      result.push(block);
      continue;
    }
    if (block.type === "paragraph" && actionPattern.test(block.text)) {
      const sentences = block.text.match(/[^.!?]+[.!?]+|\S+/g) ?? [block.text];
      const actions = sentences.filter((s) => actionPattern.test(s));
      if (actions.length >= 2) {
        result.push({
          type: "checklist",
          items: actions.map((text) => ({ text: text.trim() })),
        });
        continue;
      }
    }
    result.push(block);
  }
  return result;
}

export function normalizeDocument(doc: ChrystyDocument): ChrystyDocument {
  const blocks = doc.blocks.flatMap(enrichBlock);
  return {
    ...doc,
    title: stripMeta(doc.title),
    subtitle: doc.subtitle ? stripMeta(doc.subtitle) : undefined,
    blocks: promoteActions(blocks),
  };
}

export function prepareDocument(doc: ChrystyDocument): ChrystyDocument {
  return normalizeDocument(doc);
}
