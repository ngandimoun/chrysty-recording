/** Chrysty Design Language — spacing scale (px). */
export const CDL_SPACE = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
} as const;

export const CDL_READING_MAX = "42rem"; // ~672px

export const cdlTypography = {
  display: "cdl-display",
  title: "cdl-title",
  section: "cdl-section",
  body: "cdl-body",
  small: "cdl-small",
  caption: "cdl-caption",
} as const;

export type CdlTypography = keyof typeof cdlTypography;
