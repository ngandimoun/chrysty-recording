import type { DocumentType } from "@/lib/presentation/schema/document";
import type { DocumentTheme } from "@/lib/presentation/themes";

export function documentTypeToTheme(documentType: DocumentType): DocumentTheme {
  switch (documentType) {
    case "meeting":
    case "decision":
      return "classic";
    case "proposal":
      return "executive";
    case "journal":
      return "notebook";
    case "inspection":
      return "report";
    case "research":
      return "academic";
    case "medical":
      return "medical";
    case "legal":
      return "legal";
    case "generic":
    default:
      return "presentation";
  }
}

export function inferDocumentType(docTypeHint: string): DocumentType {
  const hint = docTypeHint.toLowerCase();
  if (/meeting|standup|sync/.test(hint)) return "meeting";
  if (/research|analysis|study/.test(hint)) return "research";
  if (/medical|clinical|patient|consult/.test(hint)) return "medical";
  if (/inspection|site|audit|report/.test(hint)) return "inspection";
  if (/decision|decisions/.test(hint)) return "decision";
  if (/journal|diary|idea|brainstorm/.test(hint)) return "journal";
  if (/proposal|strategy|executive|budget/.test(hint)) return "proposal";
  if (/legal|contract|compliance/.test(hint)) return "legal";
  return "generic";
}
