import { describe, expect, it } from "vitest";
import { toCanonicalKey } from "@/lib/agents/canonical-key";
import { agentsToToolNames } from "@/lib/agents/planner";
import { deriveAgentsFromObservations } from "@/lib/db/observations";
import type { RecordingObservation } from "@/types";

describe("toCanonicalKey", () => {
  it("slugifies titles", () => {
    expect(toCanonicalKey("Project Alpha")).toBe("project-alpha");
    expect(toCanonicalKey("Budget Report v8")).toBe("budget-report-v8");
  });
});

describe("agentsToToolNames", () => {
  it("includes only task tools for task agent", () => {
    const tools = agentsToToolNames(["task"]);
    expect(tools.has("save_attention_item")).toBe(true);
    expect(tools.has("save_document")).toBe(false);
    expect(tools.has("record_change")).toBe(false);
  });

  it("includes memory tools when memory agent selected", () => {
    const tools = agentsToToolNames(["memory"]);
    expect(tools.has("record_change")).toBe(true);
  });
});

describe("deriveAgentsFromObservations", () => {
  it("routes commitment to task agent via routing hints", () => {
    const obs: RecordingObservation = {
      id: "obs-1",
      recordingKey: "rk",
      sessionId: "s1",
      category: "commitment",
      title: "Buy milk",
      body: "Reminder to buy milk tomorrow",
      changeType: "new",
      createdAt: new Date().toISOString(),
      routingHints: { agents: ["task"] },
    };
    expect(deriveAgentsFromObservations([obs])).toContain("task");
  });

  it("routes preference to memory when no hints", () => {
    const obs: RecordingObservation = {
      id: "obs-2",
      recordingKey: "rk",
      sessionId: "s1",
      category: "preference",
      title: "Coffee",
      body: "No longer enjoys coffee",
      changeType: "updated",
      createdAt: new Date().toISOString(),
    };
    expect(deriveAgentsFromObservations([obs])).toContain("memory");
  });
});
