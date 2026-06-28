import { describe, expect, it } from "vitest";
import {
  extensionForMime,
  needsAudioTranscode,
  needsAudioTranscodeForMime,
} from "@/lib/recording/audio-format";

describe("needsAudioTranscode", () => {
  it("requires transcode for Safari MP4 container formats", () => {
    expect(extensionForMime("audio/mp4")).toBe("m4a");
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
