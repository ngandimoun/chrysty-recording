/**
 * Normalize Gemini structured output to match ChrystyDocument Zod schema.
 */
export function coerceGeminiDocument(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.blocks)) return raw;
  return {
    ...doc,
    blocks: doc.blocks.map(coerceBlock),
  };
}

function coerceBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as Record<string, unknown>;

  switch (b.type) {
    case "people":
      if (!Array.isArray(b.people) && Array.isArray(b.items)) {
        const { items, ...rest } = b;
        return { ...rest, people: items };
      }
      return b;

    case "companies":
      if (!Array.isArray(b.companies) && Array.isArray(b.items)) {
        const { items, ...rest } = b;
        return { ...rest, companies: items };
      }
      return b;

    case "checklist":
      if (Array.isArray(b.items)) {
        return {
          ...b,
          items: b.items.map(coerceChecklistItem),
        };
      }
      return b;

    case "timeline":
      if (Array.isArray(b.items)) {
        return {
          ...b,
          items: b.items.map(coerceTimelineItem),
        };
      }
      return b;

    case "decisions":
      if (Array.isArray(b.items)) {
        return {
          ...b,
          items: b.items.map(coerceDecisionItem),
        };
      }
      return b;

    case "imageGallery":
      if (!Array.isArray(b.attachmentIds) || b.attachmentIds.length === 0) {
        if (Array.isArray(b.captions) && b.captions.length > 0) {
          return {
            type: "callout",
            variant: "info",
            text: b.captions.join(" "),
          };
        }
        return {
          type: "paragraph",
          text: "Photo documentation referenced in the recording.",
        };
      }
      return b;

    default:
      return b;
  }
}

function coerceChecklistItem(item: unknown): { text: string; checked?: boolean } {
  if (typeof item === "string") return { text: item };
  if (!item || typeof item !== "object") return { text: "Action item" };
  const i = item as Record<string, unknown>;
  if (typeof i.text === "string" && i.text.trim()) {
    return {
      text: i.text.trim(),
      checked: typeof i.checked === "boolean" ? i.checked : undefined,
    };
  }
  const title = typeof i.title === "string" ? i.title.trim() : "";
  const value = typeof i.value === "string" ? i.value.trim() : "";
  if (title && value) {
    return {
      text: `${title}: ${value}`,
      checked: typeof i.checked === "boolean" ? i.checked : undefined,
    };
  }
  const parts = [title, value, i.label, i.description]
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => String(x).trim());
  return { text: parts.join(": ") || "Action item" };
}

function coerceTimelineItem(item: unknown): { label: string; date?: string; description?: string } {
  if (typeof item === "string") return { label: item };
  if (!item || typeof item !== "object") return { label: "Event" };
  const i = item as Record<string, unknown>;
  const label = String(i.label ?? i.title ?? i.text ?? "Event").trim();
  return {
    label,
    date: i.date ? String(i.date) : undefined,
    description: i.description
      ? String(i.description)
      : i.value
        ? String(i.value)
        : undefined,
  };
}

function coerceDecisionItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "Decision";
  const i = item as Record<string, unknown>;
  const title = typeof i.title === "string" ? i.title.trim() : "";
  const text = typeof i.text === "string" ? i.text.trim() : "";
  if (title && text) return `${title} — ${text}`;
  if (text) return text;
  return String(i.title ?? i.value ?? i.label ?? "Decision").trim();
}
