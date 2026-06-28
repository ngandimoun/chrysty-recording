import type { ChrystyDocument, DocumentBlock } from "@/lib/presentation/schema/document";
import { documentTypeToTheme } from "@/lib/presentation/design-engine/type-map";
import {
  getThemeConfig,
  type DocumentTheme,
  type DocumentThemeConfig,
} from "@/lib/presentation/themes";

export type ResolvedDocument = {
  document: ChrystyDocument;
  theme: DocumentTheme;
  themeConfig: DocumentThemeConfig;
  orderedBlocks: DocumentBlock[];
  sectionLabels: string[];
};

const blockSectionLabel: Partial<Record<DocumentBlock["type"], string>> = {
  summary: "Summary",
  people: "People",
  companies: "Companies",
  checklist: "Action Items",
  timeline: "Timeline",
  decisions: "Decisions",
  metrics: "Metrics",
  table: "Details",
  references: "References",
  imageGallery: "Photos",
  quote: "Quote",
};

function defaultSectionOrder(): DocumentBlock["type"][] {
  return [
    "imageGallery",
    "summary",
    "people",
    "companies",
    "decisions",
    "checklist",
    "timeline",
    "metrics",
    "table",
    "paragraph",
    "quote",
    "callout",
    "references",
    "clause",
    "code",
  ];
}

function themeSectionOrder(theme: DocumentTheme): DocumentBlock["type"][] {
  if (theme === "medical") {
    return [
      "summary",
      "people",
      "paragraph",
      "checklist",
      "decisions",
      "timeline",
      "references",
    ];
  }
  if (theme === "legal") {
    return ["summary", "clause", "decisions", "references", "paragraph"];
  }
  if (theme === "report") {
    return [
      "imageGallery",
      "summary",
      "paragraph",
      "checklist",
      "decisions",
      "references",
    ];
  }
  return defaultSectionOrder();
}

function sortBlocks(blocks: DocumentBlock[], theme: DocumentTheme): DocumentBlock[] {
  const order = themeSectionOrder(theme);
  const rank = new Map(order.map((t, i) => [t, i]));
  return [...blocks].sort(
    (a, b) => (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99)
  );
}

export function resolveDesign(document: ChrystyDocument): ResolvedDocument {
  const theme = documentTypeToTheme(document.documentType);
  const themeConfig = getThemeConfig(theme);
  let orderedBlocks = sortBlocks(document.blocks, theme);

  if (themeConfig.imageFirst) {
    const galleries = orderedBlocks.filter((b) => b.type === "imageGallery");
    const rest = orderedBlocks.filter((b) => b.type !== "imageGallery");
    orderedBlocks = [...galleries, ...rest];
  }

  const sectionLabels = orderedBlocks
    .map((b) => blockSectionLabel[b.type])
    .filter((l): l is string => Boolean(l));

  return {
    document,
    theme,
    themeConfig,
    orderedBlocks,
    sectionLabels: [...new Set(sectionLabels)],
  };
}
