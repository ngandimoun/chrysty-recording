import { describe, expect, it } from "vitest";
import {
  isAllowedContextMimeType,
  MAX_CONTEXT_FILE_BYTES,
  MAX_CONTEXT_FILES,
} from "@/lib/context/constants";

describe("context upload validation", () => {
  it("allows common document and media types", () => {
    expect(isAllowedContextMimeType("application/pdf")).toBe(true);
    expect(isAllowedContextMimeType("text/plain")).toBe(true);
    expect(isAllowedContextMimeType("image/png")).toBe(true);
    expect(isAllowedContextMimeType("audio/mpeg")).toBe(true);
  });

  it("rejects disallowed mime types", () => {
    expect(isAllowedContextMimeType("application/octet-stream")).toBe(false);
    expect(isAllowedContextMimeType("video/mp4")).toBe(false);
  });

  it("normalizes mime parameters", () => {
    expect(isAllowedContextMimeType("text/plain; charset=utf-8")).toBe(true);
  });

  it("exposes upload limits", () => {
    expect(MAX_CONTEXT_FILES).toBeGreaterThan(0);
    expect(MAX_CONTEXT_FILE_BYTES).toBeGreaterThan(0);
  });
});
