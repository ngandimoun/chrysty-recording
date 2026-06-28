import { describe, expect, it } from "vitest";
import {
  buildSessionGenerationContext,
  formatSessionContextForPrompt,
  inferPrimaryLanguage,
  localeFromLanguage,
} from "@/lib/processing/session-context";
import type { RecordingSessionRow } from "@/lib/db/types";

describe("session-context", () => {
  it("infers dominant segment language", () => {
    expect(
      inferPrimaryLanguage({
        summary: "test",
        segments: [
          { speaker: "1", timestamp: "00:00", content: "Bonjour", language: "fr", emotion: "neutral" },
          { speaker: "1", timestamp: "00:05", content: "Salut", language: "fr", emotion: "neutral" },
          { speaker: "1", timestamp: "00:10", content: "Hi", language: "en", emotion: "neutral" },
        ],
      })
    ).toBe("fr");
  });

  it("builds reference local date from session timezone", () => {
    const session = {
      id: "rec-1",
      status: "completed",
      audio_path: "rk/s/rec-1/audio.webm",
      use_case: "knowledge_capture",
      transcript: null,
      transcript_detail: null,
      gemini_file_uri: null,
      gemini_interaction_ids: null,
      processing_step: 3,
      duration_seconds: 30,
      completed_at: null,
      created_at: "2026-06-28T22:00:00.000Z",
      error_message: null,
      client_timezone: "America/Los_Angeles",
      primary_language: null,
    } satisfies RecordingSessionRow;

    const ctx = buildSessionGenerationContext(session);
    expect(ctx.referenceLocalDate).toBe("2026-06-28");
    expect(formatSessionContextForPrompt(ctx)).toContain("2026-06-28");
  });

  it("maps language codes to locales", () => {
    expect(localeFromLanguage("fr")).toBe("fr-FR");
    expect(localeFromLanguage("English")).toBe("en-US");
  });
});
