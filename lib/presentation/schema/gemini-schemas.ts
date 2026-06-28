import { documentTypes } from "./document";

const plainString = { type: "string" as const, description: "Plain text only — no markdown." };

export const documentBlockJsonSchema = {
  type: "object",
  description: "Semantic content block. No formatting fields.",
  properties: {
    type: {
      type: "string",
      enum: [
        "summary",
        "paragraph",
        "quote",
        "checklist",
        "timeline",
        "people",
        "companies",
        "decisions",
        "metrics",
        "table",
        "references",
        "imageGallery",
        "callout",
        "clause",
        "code",
      ],
    },
    text: plainString,
    paragraphs: { type: "array", items: plainString },
    attribution: plainString,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: plainString,
          checked: { type: "boolean" },
          assignee: plainString,
          due: plainString,
          label: plainString,
          value: plainString,
          trend: { type: "string", enum: ["up", "down", "stable"] },
          title: plainString,
          url: plainString,
          note: plainString,
          name: plainString,
          role: plainString,
          subtitle: plainString,
          date: plainString,
          description: plainString,
        },
      },
    },
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: plainString,
          role: plainString,
          subtitle: plainString,
        },
        required: ["name"],
      },
    },
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: { name: plainString, subtitle: plainString },
        required: ["name"],
      },
    },
    headers: { type: "array", items: plainString },
    rows: { type: "array", items: { type: "array", items: plainString } },
    attachmentIds: { type: "array", items: plainString },
    captions: { type: "array", items: plainString },
    variant: { type: "string", enum: ["info", "warning", "success"] },
  },
  required: ["type"],
};

export const chrystyDocumentJsonSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    documentType: {
      type: "string",
      enum: [...documentTypes],
      description: "Semantic document kind — drives layout theme.",
    },
    title: plainString,
    subtitle: plainString,
    blocks: {
      type: "array",
      items: documentBlockJsonSchema,
      minItems: 1,
    },
  },
  required: ["schemaVersion", "documentType", "title", "blocks"],
};
