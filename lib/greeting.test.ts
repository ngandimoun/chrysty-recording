import { describe, expect, it } from "vitest";

import { buildGreeting, greetingPlaceholder } from "@/lib/greeting-text";
import { getFirstName } from "@/lib/user-display";

describe("getFirstName", () => {
  it("returns the first token from full name", () => {
    expect(getFirstName("Chris Donson")).toBe("Chris");
  });

  it("returns null when full name is missing", () => {
    expect(getFirstName(null)).toBeNull();
    expect(getFirstName("")).toBeNull();
    expect(getFirstName("   ")).toBeNull();
  });
});

describe("buildGreeting", () => {
  it("includes first name when provided", () => {
    expect(buildGreeting("Chris", 9)).toBe("Good morning, Chris.");
    expect(buildGreeting("Chris", 14)).toBe("Good afternoon, Chris.");
    expect(buildGreeting("Chris", 20)).toBe("Good evening, Chris.");
  });

  it("omits name when not provided", () => {
    expect(buildGreeting(null, 9)).toBe("Good morning.");
  });
});

describe("greetingPlaceholder", () => {
  it("uses evening placeholder until client effect runs", () => {
    expect(greetingPlaceholder("Chris")).toBe("Good evening, Chris.");
    expect(greetingPlaceholder(null)).toBe("Good evening.");
  });
});
