import type { ChrystyDocument, DocumentBlock } from "@/lib/presentation/schema/document";

function blockToText(block: DocumentBlock): string {
  switch (block.type) {
    case "summary":
      return block.paragraphs.join("\n\n");
    case "paragraph":
    case "quote":
    case "callout":
    case "clause":
    case "code":
      return block.text;
    case "checklist":
      return block.items.map((i) => i.text).join("\n");
    case "timeline":
      return block.items.map((i) => `${i.label}${i.date ? ` (${i.date})` : ""}`).join("\n");
    case "people":
      return block.people.map((p) => p.name).join(", ");
    case "companies":
      return block.companies.map((c) => c.name).join(", ");
    case "decisions":
      return block.items.join("\n");
    case "metrics":
      return block.items.map((m) => `${m.label}: ${m.value}`).join("\n");
    case "table":
      return [block.headers.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n");
    case "references":
      return block.items.map((r) => r.title).join("\n");
    case "imageGallery":
      return block.captions?.join("\n") ?? "";
    default:
      return "";
  }
}

export function presentationDocumentToPlainText(doc: ChrystyDocument): string {
  const parts = [doc.title];
  if (doc.subtitle) parts.push(doc.subtitle);
  for (const block of doc.blocks) {
    const text = blockToText(block);
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}
