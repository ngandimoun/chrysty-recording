import { looksLikeJsonFragment } from "@/lib/presentation/json-fragment";

const MAX_PARAGRAPH_CHARS = 280;

export function splitLongParagraph(text: string): string[] {
  if (looksLikeJsonFragment(text)) return [text.trim()];
  if (text.length <= MAX_PARAGRAPH_CHARS) return [text.trim()];

  const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > MAX_PARAGRAPH_CHARS && current) {
      chunks.push(current.trim());
      current = sentence.trim();
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.trim()];
}
