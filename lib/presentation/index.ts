import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import {
  parseChrystyDocument,
  isChrystyDocument,
} from "@/lib/presentation/schema/document";
import { coerceGeminiDocument } from "@/lib/presentation/coerce-gemini-document";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { resolveDesign, type ResolvedDocument } from "@/lib/presentation/design-engine/resolve";
import { legacyContentToDocument } from "@/lib/presentation/migrate/markdown-fallback";
import { inferDocumentType } from "@/lib/presentation/design-engine/type-map";
import type { DocumentType } from "@/lib/presentation/schema/document";
import {
  tryRepairStoredPresentation,
  tryRepairEmbeddedDocument,
  isCorruptedPresentation,
} from "@/lib/presentation/repair-document";

const PRESENTATION_ATTR_KEY = "presentationDocument";

const CORRUPTED_DOC_CALLOUT =
  "This document could not be displayed correctly. Re-process the recording to regenerate formatted content.";

function tryParseStoredDocument(raw: unknown): ChrystyDocument | null {
  if (!raw || typeof raw !== "object") return null;
  if (isChrystyDocument(raw)) return raw;
  try {
    return parseChrystyDocument(coerceGeminiDocument(raw));
  } catch {
    return null;
  }
}

function tryParseJsonContent(content: string): ChrystyDocument | null {
  if (!content.includes("{")) return null;
  return tryRepairEmbeddedDocument(content);
}

function corruptedDocumentFallback(title: string, docTypeHint?: string): ResolvedDocument {
  const documentType = docTypeHint ? inferDocumentType(docTypeHint) : ("generic" as DocumentType);
  return resolveDesign(
    prepareDocument({
      schemaVersion: 1,
      documentType,
      title,
      blocks: [
        {
          type: "callout",
          variant: "warning",
          text: CORRUPTED_DOC_CALLOUT,
        },
      ],
    })
  );
}

export function extractPresentationDocument(
  attributes: Record<string, unknown> | undefined,
  previewContent: string | undefined,
  title: string,
  docTypeHint?: string
): ResolvedDocument {
  const raw = attributes?.[PRESENTATION_ATTR_KEY];
  const stored = tryParseStoredDocument(raw);

  const repaired = tryRepairStoredPresentation(stored, previewContent);
  if (repaired) {
    return resolveDesign(prepareDocument(repaired));
  }

  if (isCorruptedPresentation(stored, previewContent)) {
    return corruptedDocumentFallback(title, docTypeHint);
  }

  if (stored) {
    return resolveDesign(prepareDocument(stored));
  }

  if (previewContent?.trim()) {
    const fromJson = tryParseJsonContent(previewContent);
    if (fromJson) {
      return resolveDesign(prepareDocument(fromJson));
    }
  }

  const documentType = docTypeHint ? inferDocumentType(docTypeHint) : ("generic" as DocumentType);
  const legacy = legacyContentToDocument(previewContent, title, documentType);
  if (legacy) {
    return resolveDesign(prepareDocument(legacy));
  }

  return resolveDesign(
    prepareDocument({
      schemaVersion: 1,
      documentType: "generic",
      title,
      blocks: [{ type: "paragraph", text: "No content yet." }],
    })
  );
}

/** Returns a repaired document when the stored row embeds JSON as text. */
export function attemptPresentationRepair(
  attributes: Record<string, unknown> | undefined,
  previewContent: string | undefined,
  presentationDocument?: ChrystyDocument | null
): ChrystyDocument | null {
  const raw = presentationDocument ?? attributes?.[PRESENTATION_ATTR_KEY];
  const stored = tryParseStoredDocument(raw);
  return tryRepairStoredPresentation(stored, previewContent);
}

export function parseAndPrepareDocument(raw: unknown): ResolvedDocument {
  const doc = prepareDocument(parseChrystyDocument(raw));
  return resolveDesign(doc);
}

export function presentationDocumentForStorage(doc: ChrystyDocument): {
  presentationDocument: ChrystyDocument;
  attributesPatch: Record<string, unknown>;
} {
  const prepared = prepareDocument(doc);
  return {
    presentationDocument: prepared,
    attributesPatch: { [PRESENTATION_ATTR_KEY]: prepared },
  };
}

export { PRESENTATION_ATTR_KEY };
