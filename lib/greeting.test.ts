import { describe, expect, it } from "vitest";
import { getGreeting } from "@/lib/greeting";

describe("getGreeting", () => {
  it("returns a time-of-day greeting string", () => {
    const greeting = getGreeting();
    expect(["Good morning", "Good afternoon", "Good evening"]).toContain(greeting);
  });
});
