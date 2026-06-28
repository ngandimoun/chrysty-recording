import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_AUDIO_MIMES,
  extensionForMime,
  isLikelyAudioFile,
  needsAudioTranscode,
  needsAudioTranscodeForMime,
  resolveAudioExtension,
} from "@/lib/recording/audio-format";

describe("needsAudioTranscode", () => {
  it("requires transcode for Safari MP4 container formats", () => {
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/m4a")).toBe("m4a");
    expect(needsAudioTranscode("m4a")).toBe(true);
    expect(needsAudioTranscode("mp4")).toBe(true);
    expect(needsAudioTranscode("aac")).toBe(true);
  });

  it("requires transcode for webm", () => {
    expect(needsAudioTranscode("webm")).toBe(true);
    expect(needsAudioTranscodeForMime("audio/webm")).toBe(true);
  });

  it("skips transcode for Gemini-native formats", () => {
    expect(needsAudioTranscode("mp3")).toBe(false);
    expect(needsAudioTranscode("wav")).toBe(false);
    expect(needsAudioTranscode("ogg")).toBe(false);
    expect(needsAudioTranscodeForMime("audio/mpeg")).toBe(false);
  });
});

describe("resolveAudioExtension", () => {
  it("prefers MIME over stale filename extensions", () => {
    expect(resolveAudioExtension("audio/webm")).toBe("webm");
    expect(resolveAudioExtension("audio/mp4")).toBe("m4a");
  });
});

describe("isLikelyAudioFile", () => {
  it("detects audio by MIME prefix", () => {
    expect(isLikelyAudioFile("audio/mp4", "memo.bin")).toBe(true);
  });

  it("detects iOS voice memos with empty MIME via extension", () => {
    expect(isLikelyAudioFile("", "voice.m4a")).toBe(true);
    expect(isLikelyAudioFile("application/octet-stream", "note.caf")).toBe(true);
  });

  it("rejects non-audio files", () => {
    expect(isLikelyAudioFile("application/pdf", "doc.pdf")).toBe(false);
  });
});

/** Mirror of recording-uploads bucket audio entries in storage migrations. */
const RECORDING_UPLOADS_BUCKET_AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
] as const;

describe("ALLOWED_UPLOAD_AUDIO_MIMES vs storage bucket", () => {
  it("includes every app-accepted upload MIME in the bucket allowlist", () => {
    const bucket = new Set<string>(RECORDING_UPLOADS_BUCKET_AUDIO_MIMES);
    for (const mime of ALLOWED_UPLOAD_AUDIO_MIMES) {
      expect(bucket.has(mime)).toBe(true);
    }
  });
});
