import { describe, expect, it } from "vitest";
import { parseChrystyDocument, chrystyDocumentSchema } from "@/lib/presentation/schema/document";
import type { ChrystyDocument } from "@/lib/presentation/schema/document";
import { normalizeDocument } from "@/lib/presentation/enrich/normalize";
import { splitLongParagraph } from "@/lib/presentation/enrich/split-paragraphs";
import { documentTypeToTheme } from "@/lib/presentation/design-engine/type-map";
import { resolveDesign } from "@/lib/presentation/design-engine/resolve";
import { coerceGeminiDocument } from "@/lib/presentation/coerce-gemini-document";
import { parseChrystyDocumentJson } from "@/lib/presentation/schema/document";
import { markdownToDocument, legacyContentToDocument } from "@/lib/presentation/migrate/markdown-fallback";
import { extractPresentationDocument } from "@/lib/presentation/index";
import {
  documentContainsEmbeddedJson,
  hasMeaningfulStructure,
  tryRepairEmbeddedDocument,
  collectRepairableText,
  sanitizeLooseJson,
} from "@/lib/presentation/repair-document";
import { isCorruptedPresentation } from "@/lib/presentation/json-fragment";
import { processGeminiDocumentOutput } from "@/lib/presentation/save";

describe("ChrystyDocument schema", () => {
  it("accepts valid structured document", () => {
    const doc = parseChrystyDocument({
      schemaVersion: 1,
      documentType: "meeting",
      title: "Weekly Sync",
      blocks: [
        { type: "summary", paragraphs: ["Short summary."] },
        { type: "checklist", items: [{ text: "Follow up with Sarah" }] },
      ],
    });
    expect(doc.title).toBe("Weekly Sync");
  });

  it("rejects markdown bold", () => {
    expect(() =>
      chrystyDocumentSchema.parse({
        schemaVersion: 1,
        documentType: "generic",
        title: "Test",
        blocks: [{ type: "paragraph", text: "**bold** text" }],
      })
    ).toThrow();
  });
});

describe("normalizeDocument", () => {
  it("splits long paragraphs", () => {
    const long = "Word ".repeat(80).trim();
    const result = normalizeDocument({
      schemaVersion: 1,
      documentType: "generic",
      title: "T",
      blocks: [{ type: "paragraph", text: long }],
    });
    expect(result.blocks.length).toBeGreaterThan(1);
  });

  it("strips meta phrases", () => {
    const result = normalizeDocument({
      schemaVersion: 1,
      documentType: "generic",
      title: "Here's your summary",
      blocks: [{ type: "paragraph", text: "Real content here." }],
    });
    expect(result.title).not.toMatch(/here's your/i);
  });
});

describe("splitLongParagraph", () => {
  it("keeps short text intact", () => {
    expect(splitLongParagraph("Hello world.")).toEqual(["Hello world."]);
  });
});

describe("design engine", () => {
  it("maps meeting to classic theme", () => {
    expect(documentTypeToTheme("meeting")).toBe("classic");
  });

  it("orders image gallery first for report theme", () => {
    const resolved = resolveDesign({
      schemaVersion: 1,
      documentType: "inspection",
      title: "Site Report",
      blocks: [
        { type: "summary", paragraphs: ["Overview."] },
        { type: "imageGallery", attachmentIds: ["att-1"] },
      ],
    });
    expect(resolved.orderedBlocks[0].type).toBe("imageGallery");
  });
});

describe("coerceGeminiDocument", () => {
  it("coerces people block items alias to people array", () => {
    const sample = JSON.stringify({
      schemaVersion: 1,
      documentType: "medical",
      title: "End of Shift Report",
      blocks: [
        {
          type: "people",
          items: [
            { name: "John Doe", role: "Patient", subtitle: "Room 101" },
            { name: "Dr. Sarah Williams", role: "Physician" },
          ],
        },
      ],
    });
    const doc = parseChrystyDocumentJson(sample);
    expect(doc.blocks[0].type).toBe("people");
    if (doc.blocks[0].type === "people") {
      expect(doc.blocks[0].people).toHaveLength(2);
      expect(doc.blocks[0].people[0].name).toBe("John Doe");
    }
  });

  it("combines decision title and text with em dash", () => {
    const sample = JSON.stringify({
      schemaVersion: 1,
      documentType: "generic",
      title: "Decisions",
      blocks: [
        {
          type: "decisions",
          items: [{ title: "Medication Adjustment", text: "Change to paracetamol" }],
        },
      ],
    });
    const doc = parseChrystyDocumentJson(sample);
    if (doc.blocks[0].type === "decisions") {
      expect(doc.blocks[0].items[0]).toBe("Medication Adjustment — Change to paracetamol");
    }
  });

  it("coerces checklist and timeline items from Gemini shapes", () => {
    const sample = JSON.stringify({
      schemaVersion: 1,
      documentType: "inspection",
      title: "Site Report",
      blocks: [
        {
          type: "checklist",
          items: [{ title: "Follow up", value: "Call contractor" }],
        },
        {
          type: "timeline",
          items: [{ date: "2026-06-28", text: "Inspection completed" }],
        },
        {
          type: "decisions",
          items: [{ text: "Schedule repairs" }],
        },
      ],
    });
    const doc = parseChrystyDocumentJson(sample);
    expect(doc.blocks.length).toBe(3);
    if (doc.blocks[0].type === "checklist") {
      expect(doc.blocks[0].items[0].text).toContain("Follow up");
    }
  });
});

describe("markdown fallback", () => {
  it("converts legacy markdown to blocks", () => {
    const doc = markdownToDocument("## Summary\n\nHello **world**.", "Legacy Doc");
    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.title).toBe("Legacy Doc");
  });
});

describe("extractPresentationDocument", () => {
  it("parses JSON string in previewContent when no stored doc", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      documentType: "medical",
      title: "End of Shift Report",
      blocks: [
        { type: "summary", paragraphs: ["Patient updates recorded."] },
        { type: "callout", variant: "warning", text: "Critical supply shortage." },
      ],
    });
    const resolved = extractPresentationDocument(undefined, json, "Fallback Title");
    expect(resolved.document.title).toBe("End of Shift Report");
    expect(resolved.orderedBlocks.some((b) => b.type === "callout")).toBe(true);
  });

  it("coerces stored doc with people.items shape", () => {
    const stored = {
      schemaVersion: 1,
      documentType: "medical",
      title: "Shift Report",
      blocks: [
        {
          type: "people",
          items: [{ name: "Mary Johnson", role: "Patient", subtitle: "Room 204" }],
        },
      ],
    };
    const resolved = extractPresentationDocument(
      { presentationDocument: stored },
      undefined,
      "Shift Report"
    );
    const peopleBlock = resolved.orderedBlocks.find((b) => b.type === "people");
    expect(peopleBlock?.type).toBe("people");
    if (peopleBlock?.type === "people") {
      expect(peopleBlock.people[0].name).toBe("Mary Johnson");
    }
  });

  it("repairs corrupted stored doc with embedded JSON in summary", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "medical",
      title: "End of Shift Report",
      blocks: [
        { type: "summary", paragraphs: ["Patient updates recorded."] },
        {
          type: "people",
          people: [{ name: "John Doe", role: "Patient", subtitle: "Room 101" }],
        },
        { type: "callout", variant: "warning", text: "Critical supply shortage." },
      ],
    };
    const corrupted = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "End of Shift Report",
      blocks: [
        {
          type: "summary" as const,
          paragraphs: ["Attention Item", JSON.stringify(inner)],
        },
      ],
    } satisfies ChrystyDocument;
    expect(documentContainsEmbeddedJson(corrupted)).toBe(true);
    expect(hasMeaningfulStructure(corrupted)).toBe(false);

    const resolved = extractPresentationDocument(
      { presentationDocument: corrupted },
      undefined,
      "Follow-up: Surgical Supply Shortage"
    );
    expect(resolved.orderedBlocks.some((b) => b.type === "people")).toBe(true);
    expect(resolved.orderedBlocks.some((b) => b.type === "callout")).toBe(true);
  });

  it("parses prefixed previewContent with embedded JSON", () => {
    const inner = JSON.stringify({
      schemaVersion: 1,
      documentType: "medical",
      title: "End of Shift Report",
      blocks: [{ type: "summary", paragraphs: ["Patient updates recorded."] }],
    });
    const prefixed = `Attention Item\n\n${inner}`;
    const resolved = extractPresentationDocument(undefined, prefixed, "Fallback Title");
    expect(resolved.document.title).toBe("End of Shift Report");
  });
});

describe("processGeminiDocumentOutput", () => {
  it("does not store raw JSON as summary paragraphs when parse fails", () => {
    const badJson = 'Attention Item\n\n{ "schemaVersion": 1, "blocks": [invalid] }';
    const { document } = processGeminiDocumentOutput(badJson, "medical", "Shift Report");
    const allText = JSON.stringify(document.blocks);
    expect(allText).not.toContain('"schemaVersion"');
    expect(document.blocks[0].type).toBe("callout");
  });

  it("parses JSON wrapped in markdown fences", () => {
    const doc = {
      schemaVersion: 1,
      documentType: "medical",
      title: "Report",
      blocks: [{ type: "summary", paragraphs: ["Hello."] }],
    };
    const wrapped = "```json\n" + JSON.stringify(doc) + "\n```";
    const { document } = processGeminiDocumentOutput(wrapped, "medical", "Report");
    expect(document.title).toBe("Report");
  });
});

describe("tryRepairEmbeddedDocument", () => {
  it("extracts JSON from surrounding text", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "generic",
      title: "Test",
      blocks: [{ type: "paragraph", text: "Hello." }],
    };
    const repaired = tryRepairEmbeddedDocument(`prefix\n\n${JSON.stringify(inner)}`);
    expect(repaired?.title).toBe("Test");
  });

  it("sanitizes JSON with literal newlines in string values", () => {
    const loose = `{ "schemaVersion": 1, "documentType": "generic", "title": "Report", "blocks": [{ "type": "summary", "paragraphs": ["Dr.
Sarah Williams updated."] }] }`;
    const repaired = tryRepairEmbeddedDocument(loose);
    expect(repaired?.title).toBe("Report");
  });
});

describe("split JSON reassembly", () => {
  it("repairs JSON split across multiple summary paragraphs", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "medical",
      title: "End of Shift Report",
      blocks: [
        { type: "summary", paragraphs: ["Patient updates recorded."] },
        {
          type: "people",
          people: [{ name: "John Doe", role: "Patient", subtitle: "Room 101" }],
        },
        { type: "callout", variant: "warning", text: "Critical supply shortage." },
      ],
    };
    const json = JSON.stringify(inner);
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += 100) {
      chunks.push(json.slice(i, i + 100));
    }
    const corrupted = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "End of Shift Report",
      blocks: [
        {
          type: "summary" as const,
          paragraphs: ["Attention Item", ...chunks],
        },
      ],
    } satisfies ChrystyDocument;

    expect(documentContainsEmbeddedJson(corrupted)).toBe(true);
    const assembled = collectRepairableText(corrupted, undefined);
    expect(assembled).not.toContain("\n\n");
    const resolved = extractPresentationDocument(
      { presentationDocument: corrupted },
      undefined,
      "Follow-up"
    );
    expect(resolved.orderedBlocks.some((b) => b.type === "people")).toBe(true);
  });

  it("returns callout fallback when repair fails on corrupted stored doc", () => {
    const corrupted = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "Bad",
      blocks: [
        {
          type: "summary" as const,
          paragraphs: ['{ "schemaVersion": 1, "blocks": [invalid json here }'],
        },
      ],
    } satisfies ChrystyDocument;
    const resolved = extractPresentationDocument(
      { presentationDocument: corrupted },
      undefined,
      "Bad Doc"
    );
    expect(resolved.orderedBlocks[0].type).toBe("callout");
  });
});

describe("sanitizeLooseJson", () => {
  it("collapses newlines to spaces", () => {
    expect(sanitizeLooseJson('{\n  "a":\n"b"\n}')).toBe('{ "a": "b" }');
  });
});

describe("isCorruptedPresentation", () => {
  it("detects preview-only JSON", () => {
    expect(isCorruptedPresentation(null, '{ "schemaVersion": 1, "blocks": [] }')).toBe(true);
  });

  it("detects paragraphs starting with {", () => {
    const stored = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "T",
      blocks: [{ type: "summary" as const, paragraphs: ['{ "schemaVersion": 1'] }],
    } satisfies ChrystyDocument;
    expect(isCorruptedPresentation(stored, undefined)).toBe(true);
  });
});

describe("Procurement Alert repair", () => {
  it("repairs label + embedded JSON into structured blocks", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "medical",
      title: "Procurement Follow-up",
      blocks: [
        { type: "summary", paragraphs: ["Supply chain review needed."] },
        {
          type: "people",
          people: [{ name: "Jane Doe", role: "Procurement", subtitle: "Lead" }],
        },
        { type: "callout", variant: "warning", text: "Order delayed." },
      ],
    };
    const corrupted = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "Procurement Follow-up",
      blocks: [
        {
          type: "summary" as const,
          paragraphs: ["Procurement Alert", JSON.stringify(inner)],
        },
      ],
    } satisfies ChrystyDocument;

    const resolved = extractPresentationDocument(
      { presentationDocument: corrupted },
      undefined,
      "Procurement Follow-up"
    );
    expect(resolved.orderedBlocks.some((b) => b.type === "people")).toBe(true);
    expect(resolved.orderedBlocks.some((b) => b.type === "callout")).toBe(true);
    expect(
      resolved.orderedBlocks.some(
        (b) =>
          (b.type === "summary" || b.type === "paragraph") &&
          JSON.stringify(b).includes('"schemaVersion"')
      )
    ).toBe(false);
  });

  it("repairs JSON split across many summary paragraphs", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "generic",
      title: "Split Doc",
      blocks: [
        { type: "summary", paragraphs: ["A".repeat(200)] },
        { type: "paragraph", text: "Recovered content." },
      ],
    };
    const json = JSON.stringify(inner);
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += 50) {
      chunks.push(json.slice(i, i + 50));
    }
    expect(chunks.length).toBeGreaterThanOrEqual(4);

    const corrupted = {
      schemaVersion: 1 as const,
      documentType: "generic" as const,
      title: "Split Doc",
      blocks: [{ type: "summary" as const, paragraphs: ["Procurement Alert", ...chunks] }],
    } satisfies ChrystyDocument;

    const resolved = extractPresentationDocument(
      { presentationDocument: corrupted },
      undefined,
      "Split Doc"
    );
    expect(resolved.orderedBlocks.some((b) => b.type === "paragraph")).toBe(true);
  });

  it("uses callout or repair for preview-only corrupted content, not legacy markdown", () => {
    const inner = {
      schemaVersion: 1,
      documentType: "generic",
      title: "Preview Only",
      blocks: [{ type: "paragraph", text: "Hello from repair." }],
    };
    const preview = `Procurement Alert\n\n${JSON.stringify(inner)}`;

    const resolved = extractPresentationDocument(undefined, preview, "Preview Only");
    const hasRawJson = resolved.orderedBlocks.some(
      (b) => b.type === "summary" && b.paragraphs.some((p) => p.includes('"schemaVersion"'))
    );
    expect(hasRawJson).toBe(false);
    expect(
      resolved.orderedBlocks.some((b) => b.type === "paragraph" || b.type === "callout")
    ).toBe(true);
  });
});

describe("legacyContentToDocument", () => {
  it("returns null for JSON-containing preview", () => {
    expect(
      legacyContentToDocument('{ "schemaVersion": 1, "blocks": [] }', "Title")
    ).toBeNull();
  });

  it("still converts plain markdown", () => {
    const doc = legacyContentToDocument("Hello world.", "Title");
    expect(doc?.blocks.length).toBeGreaterThan(0);
  });
});

describe("promoteActions JSON guard", () => {
  it("does not promote JSON fragment paragraphs to checklist", () => {
    const jsonChunk =
      '{ "type": "checklist", "items": [{ "text": "We should schedule a review" }] }';
    const result = normalizeDocument({
      schemaVersion: 1,
      documentType: "generic",
      title: "T",
      blocks: [{ type: "paragraph", text: jsonChunk }],
    });
    expect(result.blocks.some((b) => b.type === "checklist")).toBe(false);
    expect(result.blocks[0].type).toBe("paragraph");
  });
});
