/**
 * Shared E2E assertion helpers (mirrored in lib/e2e/document-assertions.ts for Vitest).
 */

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function extractDocumentText(doc) {
  if (!doc) return "";
  const parts = [doc.title ?? "", doc.subtitle ?? ""];
  for (const block of doc.blocks ?? []) {
    if (block.paragraphs) parts.push(...block.paragraphs);
    if (block.text) parts.push(block.text);
    if (block.items) {
      for (const item of block.items) {
        if (typeof item === "string") parts.push(item);
        else if (item?.text) parts.push(item.text);
      }
    }
  }
  return parts.join(" ");
}

export function checkKeywords(text, requiredKeywords = [], forbiddenKeywords = []) {
  const lower = text.toLowerCase();
  const missing = requiredKeywords.filter((k) => !lower.includes(k.toLowerCase()));
  const forbidden = forbiddenKeywords.filter((k) => lower.includes(k.toLowerCase()));
  return { ok: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}

export function validatePresentationDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") {
    return { ok: false, errors: ["missing presentation document"] };
  }
  if (doc.schemaVersion !== 1) errors.push(`schemaVersion=${doc.schemaVersion}`);
  if (!doc.title || typeof doc.title !== "string") errors.push("missing title");
  if (!Array.isArray(doc.blocks) || doc.blocks.length < 2) {
    errors.push(`blocks.length=${doc.blocks?.length ?? 0} (need >= 2)`);
  }
  return { ok: errors.length === 0, errors };
}

export function inferDocumentTypeHint(docTypeHint) {
  const hint = (docTypeHint ?? "").toLowerCase();
  if (/meeting|standup|sync/.test(hint)) return "meeting";
  if (/research|analysis|study/.test(hint)) return "research";
  if (/medical|clinical|patient|consult/.test(hint)) return "medical";
  if (/inspection|site|audit|report/.test(hint)) return "inspection";
  if (/decision|decisions/.test(hint)) return "decision";
  if (/journal|diary|idea|brainstorm/.test(hint)) return "journal";
  if (/proposal|strategy|executive|budget/.test(hint)) return "proposal";
  if (/legal|contract|compliance/.test(hint)) return "legal";
  return "generic";
}
