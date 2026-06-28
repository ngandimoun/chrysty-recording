export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function jaccardSimilarity(a: string, b: string): number {
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

export function checkKeywords(
  text: string,
  requiredKeywords: string[] = [],
  forbiddenKeywords: string[] = []
): { ok: boolean; missing: string[]; forbidden: string[] } {
  const lower = text.toLowerCase();
  const missing = requiredKeywords.filter((k) => !lower.includes(k.toLowerCase()));
  const forbidden = forbiddenKeywords.filter((k) => lower.includes(k.toLowerCase()));
  return { ok: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}

export function inferDocumentTypeHint(docTypeHint: string): string {
  const hint = docTypeHint.toLowerCase();
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
