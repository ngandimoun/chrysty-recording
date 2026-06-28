import { describe, expect, it } from "vitest";
import {
  checkKeywords,
  inferDocumentTypeHint,
  jaccardSimilarity,
} from "@/lib/e2e/document-assertions";

describe("document E2E assertion helpers", () => {
  it("checks required and forbidden keywords", () => {
    const ok = checkKeywords(
      "Roof inspection with contractor follow-up",
      ["roof", "inspection"],
      ["patient", "HIPAA"]
    );
    expect(ok.ok).toBe(true);

    const bad = checkKeywords("Patient blood pressure", ["roof"], ["patient"]);
    expect(bad.ok).toBe(false);
    expect(bad.missing).toContain("roof");
    expect(bad.forbidden).toContain("patient");
  });

  it("detects high similarity between identical texts", () => {
    const a = "Site inspection report roof contractor shingles";
    expect(jaccardSimilarity(a, a)).toBe(1);
    expect(jaccardSimilarity(a, "Completely different vocabulary here")).toBeLessThan(0.2);
  });

  it("maps docType hints to document types", () => {
    expect(inferDocumentTypeHint("Site Inspection Report")).toBe("inspection");
    expect(inferDocumentTypeHint("Patient consult notes")).toBe("medical");
    expect(inferDocumentTypeHint("Legal compliance memo")).toBe("legal");
    expect(inferDocumentTypeHint("Email draft")).toBe("generic");
  });
});
