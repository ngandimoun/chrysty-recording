import { describe, expect, it } from "vitest";

import { formatDueDate, formatRelativeTime } from "@/lib/format";

describe("format helpers", () => {
  it("formatRelativeTime survives invalid locale", () => {
    const result = formatRelativeTime("2020-01-15T12:00:00.000Z", "not-a-real-locale");
    expect(result).toMatch(/Jan|2020-01-15/);
  });

  it("formatDueDate survives invalid locale", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const result = formatDueDate(future.toISOString(), "not-a-real-locale");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("Today");
    expect(result).not.toBe("Tomorrow");
  });
});
