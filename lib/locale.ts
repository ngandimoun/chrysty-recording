export const UI_LOCALE = "en-US" as const;

export const LANGUAGE_LOCALE: Record<string, string> = {
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
  hi: "hi-IN",
  ru: "ru-RU",
  sv: "sv-SE",
  da: "da-DK",
  nb: "nb-NO",
  no: "nb-NO",
  fi: "fi-FI",
  pl: "pl-PL",
  tr: "tr-TR",
  he: "he-IL",
  id: "id-ID",
  vi: "vi-VN",
  th: "th-TH",
  uk: "uk-UA",
  cs: "cs-CZ",
  el: "el-GR",
  ro: "ro-RO",
  hu: "hu-HU",
};

/** Invalid tags produced by naive lang-REGION synthesis (e.g. hi → hi-HI). */
const INVALID_LOCALE_TAGS = new Set(["hi-HI", "en-EN", "zh-ZH"]);

const KNOWN_LOCALE_VALUES = new Set(Object.values(LANGUAGE_LOCALE));

function probeLocale(locale: string): void {
  const probe = new Date("2020-06-15T12:00:00.000Z");
  probe.toLocaleDateString(locale, { month: "short", day: "numeric" });
  probe.toLocaleDateString(locale, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function resolveLocale(locale?: string | null): string {
  const candidate = locale?.trim();
  if (!candidate || INVALID_LOCALE_TAGS.has(candidate)) return UI_LOCALE;

  try {
    const parsed = new Intl.Locale(candidate.replace("_", "-"));
    const canonical = parsed.toString();
    if (INVALID_LOCALE_TAGS.has(canonical)) return UI_LOCALE;

    const base = parsed.language.toLowerCase();
    if (KNOWN_LOCALE_VALUES.has(canonical)) {
      probeLocale(canonical);
      return canonical;
    }
    if (LANGUAGE_LOCALE[base] && parsed.region) {
      probeLocale(canonical);
      return canonical;
    }
    if (LANGUAGE_LOCALE[base]) {
      return LANGUAGE_LOCALE[base];
    }
    return UI_LOCALE;
  } catch {
    return UI_LOCALE;
  }
}

export function localeFromLanguage(language: string): string {
  const trimmed = language.trim();
  const key = trimmed.toLowerCase();
  if (LANGUAGE_LOCALE[key]) return LANGUAGE_LOCALE[key];
  if (key.includes("-") || key.includes("_")) {
    return resolveLocale(trimmed);
  }
  return UI_LOCALE;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(UI_LOCALE, { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
