import { describe, expect, it } from "vitest";

import { isValidTimezone, resolveLocale, UI_LOCALE } from "@/lib/locale";

describe("resolveLocale", () => {
  it("returns UI_LOCALE for empty input", () => {
    expect(resolveLocale()).toBe(UI_LOCALE);
    expect(resolveLocale(null)).toBe(UI_LOCALE);
    expect(resolveLocale("")).toBe(UI_LOCALE);
  });

  it("accepts valid BCP47 tags", () => {
    expect(resolveLocale("fr-FR")).toBe("fr-FR");
    expect(resolveLocale("de-DE")).toBe("de-DE");
  });

  it("falls back for invalid tags", () => {
    expect(resolveLocale("not-a-real-locale")).toBe(UI_LOCALE);
    expect(resolveLocale("hi-HI")).toBe(UI_LOCALE);
    expect(resolveLocale("!!!")).toBe(UI_LOCALE);
  });
});

describe("isValidTimezone", () => {
  it("accepts IANA time zones", () => {
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/Paris")).toBe(true);
  });

  it("rejects invalid time zones", () => {
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });
});
