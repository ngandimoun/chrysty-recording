import { z } from "zod";

export const OBSERVATION_CATEGORIES = [
  "person",
  "relationship",
  "organization",
  "project",
  "object",
  "location",
  "event",
  "decision",
  "commitment",
  "preference",
  "intention",
  "goal",
  "risk",
  "opportunity",
  "problem",
  "change",
  "fact",
  "question",
  "emotion",
  "timeline",
  "evidence",
  "availability",
  "uncertainty",
  "trend",
  "metric",
  "policy",
  "inventory",
] as const;

export type ObservationCategory = (typeof OBSERVATION_CATEGORIES)[number];

export const CHANGE_TYPES = ["new", "updated", "removed", "reaffirmed"] as const;
export type ObservationChangeType = (typeof CHANGE_TYPES)[number];

const checklistCoverageSchema = z.object({
  person: z.boolean().optional(),
  relationship: z.boolean().optional(),
  preference: z.boolean().optional(),
  event: z.boolean().optional(),
  project: z.boolean().optional(),
  commitment: z.boolean().optional(),
  promise: z.boolean().optional(),
  concern: z.boolean().optional(),
  change: z.boolean().optional(),
  trend: z.boolean().optional(),
  opportunity: z.boolean().optional(),
  risk: z.boolean().optional(),
  futureRelevance: z.boolean().optional(),
});

const rawObservationSchema = z.object({
  category: z.enum(OBSERVATION_CATEGORIES),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceQuote: z.string().optional(),
  sourceTimestamp: z.string().optional(),
  changeType: z.enum(CHANGE_TYPES).optional().default("new"),
  canonicalKey: z.string().optional(),
  affectedEntityKeys: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const observationAgentOutputSchema = z.object({
  observations: z.array(rawObservationSchema),
  analystSummary: z.string(),
  checklistCoverage: checklistCoverageSchema.optional(),
});

export type ObservationAgentOutput = z.infer<typeof observationAgentOutputSchema>;
export type RawObservation = z.infer<typeof rawObservationSchema>;

const significanceScoreSchema = z.object({
  observationIndex: z.number().int().nonnegative(),
  importance: z.number().min(0).max(1),
  shortTermImportance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  updateExisting: z.boolean(),
  createNew: z.boolean(),
  needsFollowUp: z.boolean(),
  needsReminder: z.boolean(),
  needsHumanReview: z.boolean(),
  routingAgents: z.array(
    z.enum(["entity", "timeline", "task", "memory", "document"])
  ),
});

export const significanceScorerOutputSchema = z.object({
  scores: z.array(significanceScoreSchema),
});

export type SignificanceScorerOutput = z.infer<typeof significanceScorerOutputSchema>;

export const observationAgentJsonSchema = {
  type: "object",
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...OBSERVATION_CATEGORIES] },
          title: { type: "string" },
          body: { type: "string" },
          sourceQuote: { type: "string" },
          sourceTimestamp: { type: "string" },
          changeType: { type: "string", enum: [...CHANGE_TYPES] },
          canonicalKey: { type: "string" },
          affectedEntityKeys: { type: "array", items: { type: "string" } },
          attributes: { type: "object" },
        },
        required: ["category", "title", "body"],
      },
    },
    analystSummary: { type: "string" },
    checklistCoverage: {
      type: "object",
      properties: {
        person: { type: "boolean" },
        relationship: { type: "boolean" },
        preference: { type: "boolean" },
        event: { type: "boolean" },
        project: { type: "boolean" },
        commitment: { type: "boolean" },
        promise: { type: "boolean" },
        concern: { type: "boolean" },
        change: { type: "boolean" },
        trend: { type: "boolean" },
        opportunity: { type: "boolean" },
        risk: { type: "boolean" },
        futureRelevance: { type: "boolean" },
      },
    },
  },
  required: ["observations", "analystSummary"],
};

export const significanceScorerJsonSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          observationIndex: { type: "integer" },
          importance: { type: "number" },
          shortTermImportance: { type: "number" },
          confidence: { type: "number" },
          novelty: { type: "number" },
          updateExisting: { type: "boolean" },
          createNew: { type: "boolean" },
          needsFollowUp: { type: "boolean" },
          needsReminder: { type: "boolean" },
          needsHumanReview: { type: "boolean" },
          routingAgents: {
            type: "array",
            items: {
              type: "string",
              enum: ["entity", "timeline", "task", "memory", "document"],
            },
          },
        },
        required: [
          "observationIndex",
          "importance",
          "shortTermImportance",
          "confidence",
          "novelty",
          "updateExisting",
          "createNew",
          "needsFollowUp",
          "needsReminder",
          "needsHumanReview",
          "routingAgents",
        ],
      },
    },
  },
  required: ["scores"],
};
