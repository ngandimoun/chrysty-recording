import { describe, expect, it } from "vitest";
import { normalizeDueAt } from "@/lib/dates/normalize-due-at";

describe("normalizeDueAt", () => {
  it("returns ISO string for valid datetime", () => {
    expect(normalizeDueAt("2026-06-30T09:00:00-07:00")).toBe("2026-06-30T16:00:00.000Z");
  });

  it("rejects invalid values", () => {
    expect(normalizeDueAt("not-a-date")).toBeUndefined();
    expect(normalizeDueAt("")).toBeUndefined();
  });

  it("handles date-only strings", () => {
    const result = normalizeDueAt("2026-06-30", { timezone: "America/Los_Angeles" });
    expect(result).toBeDefined();
  });
});
