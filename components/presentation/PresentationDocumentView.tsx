"use client";

import type { KnowledgeObject } from "@/types";
import { extractPresentationDocument } from "@/lib/presentation";
import {
  hasMeaningfulStructure,
  documentContainsEmbeddedJson,
  isCorruptedPresentation,
} from "@/lib/presentation/repair-document";
import { DocumentRenderer } from "@/lib/presentation/render/DocumentRenderer";

interface PresentationDocumentViewProps {
  object?: KnowledgeObject;
  title?: string;
  updatedAt?: string;
  previewContent?: string;
  docTypeHint?: string;
  animate?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  className?: string;
}

function contentHasEmbeddedJson(content: string): boolean {
  return (
    content.includes("{") &&
    content.includes('"schemaVersion"') &&
    content.includes('"blocks"')
  );
}

export function PresentationDocumentView({
  object,
  title,
  updatedAt,
  previewContent,
  docTypeHint,
  animate = true,
  compact = false,
  hideTitle = false,
  className,
}: PresentationDocumentViewProps) {
  const attrs =
    object?.presentationDocument != null
      ? { ...(object.attributes ?? {}), presentationDocument: object.presentationDocument }
      : object?.attributes;

  const resolved = extractPresentationDocument(
    attrs,
    object?.previewContent ?? previewContent,
    object?.title ?? title ?? "Document",
    docTypeHint ?? (object?.type === "document" ? object.title : undefined)
  );

  return (
    <DocumentRenderer
      resolved={resolved}
      updatedAt={object?.updatedAt ?? updatedAt}
      animate={animate}
      compact={compact}
      hideTitle={hideTitle}
      className={className}
    />
  );
}

export function presentationPreviewText(object: KnowledgeObject): string | undefined {
  if (object.presentationDocument?.blocks?.length) {
    if (documentContainsEmbeddedJson(object.presentationDocument)) {
      // Fall through to repair path below
    } else {
      const first = object.presentationDocument.blocks[0];
      if (first.type === "summary" && first.paragraphs[0]) return first.paragraphs[0];
      if (first.type === "paragraph") return first.text;
      if (first.type === "callout") return first.text;
    }
  }

  const preview = object.previewContent;
  if (preview && !contentHasEmbeddedJson(preview)) {
    return preview.slice(0, 120);
  }

  if (preview && contentHasEmbeddedJson(preview)) {
    try {
      const attrs =
        object.presentationDocument != null
          ? { ...(object.attributes ?? {}), presentationDocument: object.presentationDocument }
          : object.attributes;
      const resolved = extractPresentationDocument(
        attrs,
        preview,
        object.title,
        object.type === "document" ? object.title : undefined
      );
      const first = resolved.orderedBlocks[0];
      if (first?.type === "summary" && first.paragraphs[0]) return first.paragraphs[0];
      if (first?.type === "paragraph") return first.text;
      if (first?.type === "callout") return first.text;
    } catch {
      return undefined;
    }
  }

  return object.subtitle?.slice(0, 120);
}

export function hasStructuredPresentation(object: KnowledgeObject): boolean {
  if (isCorruptedPresentation(object.presentationDocument, object.previewContent)) {
    return true;
  }
  if (object.presentationDocument?.blocks?.length) {
    return hasMeaningfulStructure(object.presentationDocument);
  }
  if (object.previewContent && contentHasEmbeddedJson(object.previewContent)) {
    return true;
  }
  return false;
}
