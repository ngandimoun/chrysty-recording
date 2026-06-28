import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import {
  parseChrystyDocumentJson,
  parseChrystyDocument,
  isChrystyDocument,
} from "@/lib/presentation/schema/document";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { inferDocumentType } from "@/lib/presentation/design-engine/type-map";
import { presentationDocumentToPlainText } from "@/lib/presentation/to-plain-text";
import { presentationDocumentForStorage } from "@/lib/presentation/index";
import {
  stripMarkdownCodeFences,
  tryRepairEmbeddedDocument,
  documentContainsEmbeddedJson,
} from "@/lib/presentation/repair-document";
import {
  getKnowledgeObjectDb,
  updateKnowledgeObjectFields,
} from "@/lib/db/queries";

function outputContainsEmbeddedJson(text: string): boolean {
  return text.includes('"schemaVersion"') && text.includes('"blocks"');
}

function safePlainText(doc: ChrystyDocument): string {
  if (documentContainsEmbeddedJson(doc)) {
    return doc.title || "Document";
  }
  return presentationDocumentToPlainText(doc);
}

export function processGeminiDocumentOutput(
  outputText: string,
  docTypeHint: string,
  fallbackTitle: string
): { document: ChrystyDocument; plainText: string } {
  const stripped = stripMarkdownCodeFences(outputText);
  let doc: ChrystyDocument;

  try {
    doc = prepareDocument(parseChrystyDocumentJson(stripped));
  } catch {
    const repaired = tryRepairEmbeddedDocument(stripped);
    if (repaired) {
      doc = repaired;
    } else if (outputContainsEmbeddedJson(stripped)) {
      doc = prepareDocument({
        schemaVersion: 1,
        documentType: inferDocumentType(docTypeHint),
        title: fallbackTitle,
        blocks: [
          {
            type: "callout",
            variant: "warning",
            text: "Document structure could not be parsed. Re-process this recording to regenerate formatted content.",
          },
        ],
      });
    } else {
      doc = prepareDocument({
        schemaVersion: 1,
        documentType: inferDocumentType(docTypeHint),
        title: fallbackTitle,
        blocks: [
          {
            type: "summary",
            paragraphs: stripped.trim().split(/\n{2,}/).filter(Boolean).slice(0, 5),
          },
        ],
      });
    }
  }

  return {
    document: doc,
    plainText: safePlainText(doc),
  };
}

export async function saveKnowledgeObjectPresentation(
  objectId: string,
  recordingKey: string,
  document: ChrystyDocument
): Promise<void> {
  const existing = await getKnowledgeObjectDb(objectId, recordingKey);
  const { attributesPatch, presentationDocument } = presentationDocumentForStorage(document);
  const mergedAttributes = {
    ...(existing?.attributes ?? {}),
    ...attributesPatch,
  };
  await updateKnowledgeObjectFields(objectId, {
    previewContent: safePlainText(presentationDocument),
    attributes: mergedAttributes,
    presentationDocument: presentationDocument as unknown as Record<string, unknown>,
  });
}

export async function repairKnowledgeObjectPresentation(
  objectId: string,
  recordingKey: string,
  document: ChrystyDocument
): Promise<void> {
  await saveKnowledgeObjectPresentation(objectId, recordingKey, document);
}

export function parseStoredPresentation(
  attributes: Record<string, unknown> | undefined
): ChrystyDocument | null {
  const raw = attributes?.presentationDocument;
  if (!isChrystyDocument(raw)) return null;
  try {
    return prepareDocument(parseChrystyDocument(raw));
  } catch {
    return null;
  }
}
