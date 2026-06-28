import { describe, expect, it } from "vitest";
import { observationAgentOutputSchema } from "@/lib/agents/observation-schema";
import { deriveAgentsFromObservations } from "@/lib/db/observations";
import type { RecordingObservation } from "@/types";

describe("observationAgentOutputSchema", () => {
  it("parses wedding absence example", () => {
    const output = observationAgentOutputSchema.parse({
      observations: [
        {
          category: "person",
          title: "Brother",
          body: "User has a brother in their family.",
          sourceQuote: "my brother's wedding",
          changeType: "new",
        },
        {
          category: "relationship",
          title: "Family",
          body: "Parents are the user's parents; brother is a sibling.",
          sourceQuote: "My parents are going to my brother's wedding",
        },
        {
          category: "event",
          title: "Brother's wedding",
          body: "Upcoming wedding involving the user's brother.",
        },
        {
          category: "timeline",
          title: "Wedding attendance",
          body: "Parents will attend; user will not attend.",
          sourceQuote: "I won't be there",
        },
        {
          category: "availability",
          title: "User absent",
          body: "User will not be at the wedding.",
        },
      ],
      analystSummary: "Family wedding; user absent.",
      checklistCoverage: { person: true, relationship: true, event: true, futureRelevance: true },
    });
    expect(output.observations.length).toBeGreaterThanOrEqual(5);
  });

  it("parses preference change", () => {
    const output = observationAgentOutputSchema.parse({
      observations: [
        {
          category: "preference",
          title: "Coffee preference",
          body: "User no longer enjoys coffee.",
          sourceQuote: "I don't enjoy coffee anymore",
          changeType: "updated",
          canonicalKey: "preference:coffee",
        },
      ],
      analystSummary: "Preference shift away from coffee.",
    });
    expect(output.observations[0].category).toBe("preference");
  });
});

describe("deriveAgentsFromObservations", () => {
  it("routes entity and timeline from categories", () => {
    const obs: RecordingObservation[] = [
      {
        id: "obs-1",
        recordingKey: "rk",
        sessionId: "s1",
        category: "person",
        title: "Brother",
        body: "Sibling",
        changeType: "new",
        createdAt: new Date().toISOString(),
        routingHints: { agents: ["entity"] },
      },
      {
        id: "obs-2",
        recordingKey: "rk",
        sessionId: "s1",
        category: "event",
        title: "Wedding",
        body: "Family event",
        changeType: "new",
        createdAt: new Date().toISOString(),
        routingHints: { agents: ["timeline"] },
      },
    ];
    const agents = deriveAgentsFromObservations(obs);
    expect(agents).toContain("entity");
    expect(agents).toContain("timeline");
  });
});
