export const documentThemes = [
  "classic",
  "executive",
  "notebook",
  "report",
  "academic",
  "presentation",
  "medical",
  "legal",
] as const;

export type DocumentTheme = (typeof documentThemes)[number];

export type DocumentThemeConfig = {
  id: DocumentTheme;
  titleScale: "display" | "title";
  sectionSpacing: 24 | 32 | 48;
  cardStyle: "flat" | "elevated" | "bordered";
  tableStyle: "minimal" | "executive" | "academic";
  paragraphDensity: "compact" | "comfortable" | "airy";
  imageFirst: boolean;
  numberedSections: boolean;
};

export const themeConfigs: Record<DocumentTheme, DocumentThemeConfig> = {
  classic: {
    id: "classic",
    titleScale: "title",
    sectionSpacing: 24,
    cardStyle: "bordered",
    tableStyle: "minimal",
    paragraphDensity: "comfortable",
    imageFirst: false,
    numberedSections: false,
  },
  executive: {
    id: "executive",
    titleScale: "display",
    sectionSpacing: 32,
    cardStyle: "elevated",
    tableStyle: "executive",
    paragraphDensity: "compact",
    imageFirst: false,
    numberedSections: false,
  },
  notebook: {
    id: "notebook",
    titleScale: "title",
    sectionSpacing: 32,
    cardStyle: "flat",
    tableStyle: "minimal",
    paragraphDensity: "airy",
    imageFirst: false,
    numberedSections: false,
  },
  report: {
    id: "report",
    titleScale: "title",
    sectionSpacing: 24,
    cardStyle: "bordered",
    tableStyle: "executive",
    paragraphDensity: "comfortable",
    imageFirst: true,
    numberedSections: false,
  },
  academic: {
    id: "academic",
    titleScale: "title",
    sectionSpacing: 24,
    cardStyle: "bordered",
    tableStyle: "academic",
    paragraphDensity: "comfortable",
    imageFirst: false,
    numberedSections: true,
  },
  presentation: {
    id: "presentation",
    titleScale: "display",
    sectionSpacing: 48,
    cardStyle: "flat",
    tableStyle: "minimal",
    paragraphDensity: "airy",
    imageFirst: false,
    numberedSections: false,
  },
  medical: {
    id: "medical",
    titleScale: "title",
    sectionSpacing: 24,
    cardStyle: "bordered",
    tableStyle: "minimal",
    paragraphDensity: "comfortable",
    imageFirst: false,
    numberedSections: true,
  },
  legal: {
    id: "legal",
    titleScale: "title",
    sectionSpacing: 32,
    cardStyle: "bordered",
    tableStyle: "academic",
    paragraphDensity: "comfortable",
    imageFirst: false,
    numberedSections: true,
  },
};

export function getThemeConfig(theme: DocumentTheme): DocumentThemeConfig {
  return themeConfigs[theme];
}
