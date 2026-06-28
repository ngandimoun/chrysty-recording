import { toCanonicalKey } from "@/lib/agents/canonical-key";
import {
  deriveAgentsFromObservations,
  deriveSearchQueriesFromObservations,
} from "@/lib/db/observations";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import { CHRYSTY_PLANNER_PROMPT } from "@/lib/gemini/prompts";
import type { AgentName, PlannerDispatch, RecordingClass } from "@/lib/agents/types";
import { formatObservationsForPrompt } from "@/lib/db/observations";
import type { RecordingObservation } from "@/types";

const plannerJsonSchema = {
  type: "object",
  properties: {
    recordingClass: {
      type: "string",
      enum: ["reminder", "update", "meeting", "brainstorm", "full"],
    },
    agents: {
      type: "array",
      items: {
        type: "string",
        enum: ["entity", "timeline", "task", "memory", "document"],
      },
    },
    observationIdsByAgent: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "string" },
      },
    },
    ignoreObservationIds: { type: "array", items: { type: "string" } },
    searchQueries: { type: "array", items: { type: "string" } },
    affectedCanonicalKeys: { type: "array", items: { type: "string" } },
    documentTypes: { type: "array", items: { type: "string" } },
  },
  required: ["recordingClass", "agents"],
};

function heuristicDispatch(observations: RecordingObservation[]): PlannerDispatch {
  const agents = deriveAgentsFromObservations(observations);
  const observationIdsByAgent: Partial<Record<AgentName, string[]>> = {};

  for (const obs of observations) {
    if (obs.novelty != null && obs.novelty < 0.15 && obs.changeType === "reaffirmed") continue;
    const targetAgents = obs.routingHints?.agents?.length
      ? obs.routingHints.agents
      : deriveAgentsFromObservations([obs]);
    for (const agent of targetAgents) {
      if (!observationIdsByAgent[agent]) observationIdsByAgent[agent] = [];
      observationIdsByAgent[agent]!.push(obs.id);
    }
  }

  const hasTaskOnly =
    agents.length === 1 &&
    agents[0] === "task" &&
    observations.every((o) => o.category === "commitment" || o.needsReminder);

  return {
    recordingClass: hasTaskOnly ? "reminder" : observations.some((o) => o.changeType === "updated") ? "update" : "full",
    agents: [...new Set(agents)],
    observationIdsByAgent,
    ignoreObservationIds: observations
      .filter((o) => o.novelty != null && o.novelty < 0.1 && o.changeType === "reaffirmed")
      .map((o) => o.id),
    searchQueries: deriveSearchQueriesFromObservations(observations),
    affectedCanonicalKeys: observations
      .map((o) => o.canonicalKey)
      .filter((k): k is string => Boolean(k))
      .map(toCanonicalKey),
  };
}

export async function runPlanner(params: {
  observations: RecordingObservation[];
  analystSummary: string;
  flatTranscript: string;
  onUsage?: (usage?: { total_input_tokens?: number; total_output_tokens?: number }) => void;
}): Promise<PlannerDispatch> {
  if (params.observations.length === 0) {
    return {
      recordingClass: "full",
      agents: [],
      observationIdsByAgent: {},
      ignoreObservationIds: [],
      searchQueries: [],
      affectedCanonicalKeys: [],
      analystSummary: params.analystSummary,
    };
  }

  const fallback = heuristicDispatch(params.observations);
  fallback.analystSummary = params.analystSummary;

  const client = getGeminiClient();
  const interaction = await client.interactions.create({
    model: GEMINI_MODELS.planner,
    input: `Analyst summary: ${params.analystSummary}

Scored observations:
${formatObservationsForPrompt(params.observations)}

Observation ids for reference: ${params.observations.map((o) => o.id).join(", ")}

Transcript excerpt (reference only):
${params.flatTranscript.slice(0, 2000)}`,
    system_instruction: CHRYSTY_PLANNER_PROMPT,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: plannerJsonSchema,
    },
    generation_config: { ...GENERATION_PRESETS.extraction, thinking_level: "low" },
    store: false,
  });

  params.onUsage?.(interaction.usage);

  if (interaction.output_text) {
    try {
      const parsed = JSON.parse(interaction.output_text) as PlannerDispatch;
      if (parsed.agents?.length > 0) {
        return {
          ...fallback,
          ...parsed,
          observationIdsByAgent: parsed.observationIdsByAgent ?? fallback.observationIdsByAgent,
          ignoreObservationIds: parsed.ignoreObservationIds ?? fallback.ignoreObservationIds,
          searchQueries: parsed.searchQueries?.length
            ? parsed.searchQueries
            : fallback.searchQueries,
          affectedCanonicalKeys: parsed.affectedCanonicalKeys?.length
            ? parsed.affectedCanonicalKeys
            : fallback.affectedCanonicalKeys,
          analystSummary: params.analystSummary,
        };
      }
    } catch {
      /* use heuristic */
    }
  }

  return fallback;
}

/** Map PlannerDispatch to QuickPlan shape for retrieve-context compatibility. */
export function dispatchToQuickPlan(dispatch: PlannerDispatch) {
  return {
    recordingClass: dispatch.recordingClass as RecordingClass,
    agents: dispatch.agents,
    searchQueries: dispatch.searchQueries,
    affectedCanonicalKeys: dispatch.affectedCanonicalKeys,
  };
}

/** @deprecated Use runPlanner */
export { runPlanner as runQuickPlanner };

export function agentsToToolNames(agents: AgentName[]): Set<string> {
  const tools = new Set<string>(["search_existing_objects", "resolve_entity"]);

  if (agents.includes("entity")) {
    [
      "save_person",
      "save_place",
      "save_company",
      "save_idea",
      "save_object",
      "update_knowledge_object",
      "create_knowledge_object",
      "link_related_objects",
      "link_entities",
    ].forEach((t) => tools.add(t));
  }
  if (agents.includes("memory")) {
    tools.add("record_change");
    tools.add("update_knowledge_object");
  }
  if (agents.includes("document")) {
    tools.add("save_document");
    tools.add("update_document");
  }
  if (agents.includes("task")) {
    tools.add("save_attention_item");
    tools.add("update_attention_item");
  }
  if (agents.includes("timeline")) {
    tools.add("save_event");
    tools.add("update_knowledge_object");
    tools.add("create_knowledge_object");
  }

  return tools;
}
