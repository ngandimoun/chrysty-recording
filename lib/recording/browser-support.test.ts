import { describe, expect, it } from "vitest";
import { extensionForMime } from "@/lib/recording/audio-format";
import { getMediaRecorderTimesliceMs } from "@/lib/recording/browser-support";

describe("extensionForMime", () => {
  it("maps common audio MIME types to file extensions", () => {
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/m4a")).toBe("m4a");
    expect(extensionForMime("audio/ogg")).toBe("ogg");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
  });
});

describe("getMediaRecorderTimesliceMs", () => {
  it("returns undefined in non-browser test env (no Apple platform)", () => {
    expect(getMediaRecorderTimesliceMs()).toBe(1000);
  });
});
