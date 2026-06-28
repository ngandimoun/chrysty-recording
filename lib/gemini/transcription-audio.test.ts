import { describe, expect, it } from "vitest";
import {
  TRANSCRIPTION_INLINE_MIME,
  buildTranscriptionAudioInput,
  resolveSessionInputExtension,
} from "@/lib/gemini/upload-gemini-file";

describe("buildTranscriptionAudioInput", () => {
  it("uses inline base64 data instead of a Files URI", () => {
    const input = buildTranscriptionAudioInput(Buffer.from("fake-mp3-bytes"));
    expect(input.type).toBe("audio");
    expect(input.mime_type).toBe(TRANSCRIPTION_INLINE_MIME);
    expect(input.data).toBe(Buffer.from("fake-mp3-bytes").toString("base64"));
    expect("uri" in input).toBe(false);
  });
});

describe("resolveSessionInputExtension", () => {
  it("prefers storage contentType over path extension", () => {
    expect(
      resolveSessionInputExtension(
        "rk_test/rec-1/audio.webm",
        "audio/webm",
        "audio/mp4"
      )
    ).toBe("m4a");
  });

  it("falls back to recorderMimeType when storage contentType is missing", () => {
    expect(
      resolveSessionInputExtension("rk_test/rec-1/audio.webm", "audio/mp4")
    ).toBe("m4a");
  });

  it("falls back to path extension when no MIME hints exist", () => {
    expect(resolveSessionInputExtension("rk_test/rec-1/audio.webm")).toBe("webm");
  });
});

describe("processing pipeline_state merge", () => {
  it("preserves recorderMimeType when starting transcribing phase", () => {
    const prev = { recorderMimeType: "audio/mp4", clientTimezone: "Africa/Bangui" };
    const merged = { ...prev, phase: "transcribing" };
    expect(merged.recorderMimeType).toBe("audio/mp4");
    expect(merged.phase).toBe("transcribing");
  });
});
