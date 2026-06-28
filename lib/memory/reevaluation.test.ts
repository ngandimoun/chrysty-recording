import { describe, expect, it } from "vitest";
import {
  MEM0_REEVALUATION_CRITERIA,
  getRecallObservations,
  recordRecallObservation,
  shouldConsiderMem0,
} from "@/lib/memory/reevaluation";

describe("mem0 reevaluation", () => {
  it("exports decision criteria", () => {
    expect(MEM0_REEVALUATION_CRITERIA.length).toBeGreaterThan(0);
  });

  it("does not recommend Mem0 with insufficient observations", () => {
    expect(shouldConsiderMem0()).toBe(false);
  });

  it("records recall observations", () => {
    const before = getRecallObservations().length;
    recordRecallObservation({
      source: "file_search",
      query: "budget update",
      hitCount: 0,
      context: "voice_qa",
    });
    expect(getRecallObservations().length).toBeGreaterThanOrEqual(before + 1);
  });
});
