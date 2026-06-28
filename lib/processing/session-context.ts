import type { RecordingSessionRow, TranscriptionDetail } from "@/lib/db/types";

export interface SessionGenerationContext {
  sessionId: string;
  recordedAt: string;
  timezone: string;
  primaryLanguage: string;
  referenceLocalDate: string;
  locale: string;
}

const LANGUAGE_LOCALE: Record<string, string> = {
  en: "en-US",
  english: "en-US",
  fr: "fr-FR",
  french: "fr-FR",
  es: "es-ES",
  spanish: "es-ES",
  de: "de-DE",
  german: "de-DE",
  it: "it-IT",
  italian: "it-IT",
  pt: "pt-PT",
  portuguese: "pt-PT",
  nl: "nl-NL",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  ar: "ar-SA",
};

export function localeFromLanguage(language: string): string {
  const key = language.trim().toLowerCase();
  if (LANGUAGE_LOCALE[key]) return LANGUAGE_LOCALE[key];
  if (key.includes("-")) return key;
  if (key.length === 2) return `${key}-${key.toUpperCase()}`;
  return "en-US";
}

export function inferPrimaryLanguage(
  transcriptDetail: TranscriptionDetail | null | undefined
): string {
  if (!transcriptDetail?.segments?.length) return "und";

  const counts = new Map<string, number>();
  for (const segment of transcriptDetail.segments) {
    const lang = segment.language?.trim().toLowerCase();
    if (!lang || lang === "unknown" || lang === "und") continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }

  let best = "und";
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

function referenceLocalDate(recordedAt: string, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date(recordedAt));
  } catch {
    return recordedAt.slice(0, 10);
  }
}

export function buildSessionGenerationContext(
  session: RecordingSessionRow,
  transcriptDetail?: TranscriptionDetail | null
): SessionGenerationContext {
  const timezone =
    session.client_timezone?.trim() ||
    String((session.pipeline_state as Record<string, unknown> | null)?.clientTimezone ?? "") ||
    "UTC";
  const detail = transcriptDetail ?? session.transcript_detail;
  const pipelineLang = (session.pipeline_state as Record<string, unknown> | null)?.primaryLanguage;
  const primaryLanguage =
    session.primary_language?.trim() ||
    (typeof pipelineLang === "string" ? pipelineLang : "") ||
    inferPrimaryLanguage(detail) ||
    "und";
  const recordedAt = session.created_at;

  return {
    sessionId: session.id,
    recordedAt,
    timezone,
    primaryLanguage,
    referenceLocalDate: referenceLocalDate(recordedAt, timezone),
    locale: localeFromLanguage(primaryLanguage),
  };
}

export function formatSessionContextForPrompt(ctx: SessionGenerationContext): string {
  const languageLine =
    ctx.primaryLanguage === "und"
      ? "User language: unknown — match the language spoken in the transcript."
      : `User language: ${ctx.primaryLanguage} — write all titles, subtitles, document content, and attention hints in this language.`;

  return `Recording context:
- Recorded at: ${ctx.recordedAt} (${ctx.timezone})
- Reference date for relative phrases (tomorrow, yesterday, next week, in 2 days, in one month): ${ctx.referenceLocalDate}
- ${languageLine}
- Resolve relative dates against the recording datetime above, not your training cutoff. Use ISO 8601 with timezone offset for dueAt fields.`;
}

export async function inferWorkspacePrimaryLanguage(
  sessions: Array<{ primary_language?: string | null }>
): Promise<string> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const lang = session.primary_language?.trim().toLowerCase();
    if (!lang || lang === "und") continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best = "und";
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}
