import { describe, expect, it } from "vitest";
import {
  accumulateInteractionUsage,
  createTokenUsageTotals,
} from "@/lib/gemini/usage";

describe("gemini usage accumulation", () => {
  it("sums interaction token usage", () => {
    const totals = createTokenUsageTotals();
    accumulateInteractionUsage(totals, {
      total_input_tokens: 100,
      total_output_tokens: 50,
    });
    accumulateInteractionUsage(totals, {
      total_input_tokens: 25,
      total_output_tokens: 10,
    });

    expect(totals.inputTokens).toBe(125);
    expect(totals.outputTokens).toBe(60);
  });

  it("ignores missing usage", () => {
    const totals = createTokenUsageTotals();
    accumulateInteractionUsage(totals, undefined);
    expect(totals.inputTokens).toBe(0);
    expect(totals.outputTokens).toBe(0);
  });
});
