import * as z from "zod";
import { coerceGeminiDocument } from "@/lib/presentation/coerce-gemini-document";

export const documentTypes = [
  "meeting",
  "research",
  "medical",
  "inspection",
  "decision",
  "journal",
  "proposal",
  "legal",
  "generic",
] as const;

export type DocumentType = (typeof documentTypes)[number];

const checklistItemSchema = z.object({
  text: z.string().min(1),
  checked: z.boolean().optional(),
  assignee: z.string().optional(),
  due: z.string().optional(),
});

const timelineItemSchema = z.object({
  label: z.string().min(1),
  date: z.string().optional(),
  description: z.string().optional(),
});

const personEntrySchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  subtitle: z.string().optional(),
});

const companyEntrySchema = z.object({
  name: z.string().min(1),
  subtitle: z.string().optional(),
});

const metricEntrySchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  trend: z.enum(["up", "down", "stable"]).optional(),
});

const referenceEntrySchema = z.object({
  title: z.string().min(1),
  url: z.string().optional(),
  note: z.string().optional(),
});

const plainText = z
  .string()
  .min(1)
  .refine((s) => !/^[\s]*[-*•#]/.test(s), "Markdown list/heading syntax not allowed")
  .refine((s) => !/\*\*/.test(s), "Bold markdown not allowed")
  .refine((s) => !/^---$/m.test(s), "Markdown separators not allowed");

export const documentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("summary"),
    paragraphs: z.array(plainText).min(1).max(5),
  }),
  z.object({ type: z.literal("paragraph"), text: plainText }),
  z.object({
    type: z.literal("quote"),
    text: plainText,
    attribution: z.string().optional(),
  }),
  z.object({
    type: z.literal("checklist"),
    items: z.array(checklistItemSchema).min(1),
  }),
  z.object({
    type: z.literal("timeline"),
    items: z.array(timelineItemSchema).min(1),
  }),
  z.object({
    type: z.literal("people"),
    people: z.array(personEntrySchema).min(1),
  }),
  z.object({
    type: z.literal("companies"),
    companies: z.array(companyEntrySchema).min(1),
  }),
  z.object({
    type: z.literal("decisions"),
    items: z.array(plainText).min(1),
  }),
  z.object({
    type: z.literal("metrics"),
    items: z.array(metricEntrySchema).min(1),
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())),
  }),
  z.object({
    type: z.literal("references"),
    items: z.array(referenceEntrySchema).min(1),
  }),
  z.object({
    type: z.literal("imageGallery"),
    attachmentIds: z.array(z.string()).min(1),
    captions: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("callout"),
    variant: z.enum(["info", "warning", "success"]),
    text: plainText,
  }),
  z.object({ type: z.literal("clause"), text: plainText }),
  z.object({ type: z.literal("code"), text: z.string().min(1) }),
]);

export type DocumentBlock = z.infer<typeof documentBlockSchema>;

export const chrystyDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  documentType: z.enum(documentTypes),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  blocks: z.array(documentBlockSchema).min(1),
});

export type ChrystyDocument = z.infer<typeof chrystyDocumentSchema>;

export function parseChrystyDocument(raw: unknown): ChrystyDocument {
  return chrystyDocumentSchema.parse(raw);
}

export function parseChrystyDocumentJson(text: string): ChrystyDocument {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const slice =
    jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
  return parseChrystyDocument(coerceGeminiDocument(JSON.parse(slice)));
}

export function isChrystyDocument(raw: unknown): raw is ChrystyDocument {
  return chrystyDocumentSchema.safeParse(raw).success;
}
