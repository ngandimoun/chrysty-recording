import { describe, expect, it } from "vitest";
import { extensionForMime } from "@/lib/recording/audio-format";

describe("extensionForMime", () => {
  it("maps common audio MIME types to file extensions", () => {
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/ogg")).toBe("ogg");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
  });
});
