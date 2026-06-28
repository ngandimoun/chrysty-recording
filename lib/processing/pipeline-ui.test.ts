import { describe, expect, it } from "vitest";
import {
  coarseStepForPhase,
  formatObservationCountHint,
  formatProcessingCompleteDetail,
  formatSessionMeta,
  getLongWaitHint,
  getSubMessageForPhase,
  parsePipelinePhase,
} from "./pipeline-ui";

describe("coarseStepForPhase", () => {
  it("maps sub-phases to hybrid coarse steps", () => {
    expect(coarseStepForPhase("transcribing")).toBe(0);
    expect(coarseStepForPhase("observing")).toBe(1);
    expect(coarseStepForPhase("scoring")).toBe(1);
    expect(coarseStepForPhase("planning")).toBe(1);
    expect(coarseStepForPhase("materializing")).toBe(2);
    expect(coarseStepForPhase("finishing")).toBe(3);
    expect(coarseStepForPhase("enriching")).toBe(3);
  });
});

describe("getSubMessageForPhase", () => {
  it("prefers phase-specific copy when pipelinePhase is set", () => {
    expect(getSubMessageForPhase("scoring", 1, 0)).toBe("Scoring significance…");
    expect(getSubMessageForPhase("planning", 1, 0)).toBe("Planning next steps…");
    expect(getSubMessageForPhase("materializing", 2, 0)).toBe("Materializing knowledge…");
    expect(getSubMessageForPhase("enriching", 3, 0)).toBe("Indexing for search…");
  });

  it("falls back to rotating coarse step messages", () => {
    expect(getSubMessageForPhase(undefined, 0, 0)).toBe("Reading your voice…");
    expect(getSubMessageForPhase(undefined, 0, 1)).toBe("Transcribing audio…");
  });
});

describe("getLongWaitHint", () => {
  it("shows hints after thresholds on steps 0 and 1", () => {
    expect(getLongWaitHint(0, 20)).toBeNull();
    expect(getLongWaitHint(0, 35)).toContain("long recordings");
    expect(getLongWaitHint(1, 40)).toBeNull();
    expect(getLongWaitHint(1, 50)).toContain("world model");
  });
});

describe("formatObservationCountHint", () => {
  it("formats live observation counts", () => {
    expect(formatObservationCountHint(0)).toBeNull();
    expect(formatObservationCountHint(1)).toBe("1 observation captured");
    expect(formatObservationCountHint(12)).toBe("12 observations captured");
  });
});

describe("formatProcessingCompleteDetail", () => {
  it("joins observation and object counts for toasts", () => {
    expect(formatProcessingCompleteDetail(5, 2)).toBe("5 observations · 2 updates");
    expect(formatProcessingCompleteDetail(1, 1)).toBe("1 observation · 1 update");
    expect(formatProcessingCompleteDetail(0, 0)).toBeUndefined();
  });
});

describe("formatSessionMeta", () => {
  it("formats session list meta copy", () => {
    expect(formatSessionMeta(3, 2)).toBe("3 learned · 2 created");
    expect(formatSessionMeta(0, 0)).toBe("No results yet");
  });
});

describe("parsePipelinePhase", () => {
  it("accepts known phases and rejects unknown values", () => {
    expect(parsePipelinePhase("scoring")).toBe("scoring");
    expect(parsePipelinePhase("invalid")).toBeUndefined();
    expect(parsePipelinePhase(null)).toBeUndefined();
  });
});
