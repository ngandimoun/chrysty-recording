import type { AgentName, PlannerDispatch } from "@/lib/agents/types";
import { formatObservationsForPrompt, markObservationsMaterialized } from "@/lib/db/observations";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import {
  CHRYSTY_DOCUMENT_STUB_AGENT_PROMPT,
  CHRYSTY_ENTITY_AGENT_PROMPT,
  CHRYSTY_MEMORY_AGENT_PROMPT,
  CHRYSTY_TASK_AGENT_PROMPT,
  CHRYSTY_TIMELINE_AGENT_PROMPT,
} from "@/lib/gemini/prompts";
import { runToolLoop } from "@/lib/gemini/run-tool-loop";
import { FAST_EXTRACTION_TOOLS } from "@/lib/gemini/tools";
import type { ToolHandlerContext } from "@/lib/gemini/tool-handlers";
import { agentsToToolNames } from "@/lib/agents/planner";
import type { RecordingObservation } from "@/types";

const AGENT_PROMPTS: Record<AgentName, string> = {
  entity: CHRYSTY_ENTITY_AGENT_PROMPT,
  timeline: CHRYSTY_TIMELINE_AGENT_PROMPT,
  task: CHRYSTY_TASK_AGENT_PROMPT,
  memory: CHRYSTY_MEMORY_AGENT_PROMPT,
  document: CHRYSTY_DOCUMENT_STUB_AGENT_PROMPT,
};

function filterTools(agent: AgentName) {
  const names = agentsToToolNames([agent]);
  return FAST_EXTRACTION_TOOLS.filter((t) => names.has(t.name));
}

function observationsForAgent(
  dispatch: PlannerDispatch,
  agent: AgentName,
  all: RecordingObservation[]
): RecordingObservation[] {
  const ids = new Set(dispatch.observationIdsByAgent[agent] ?? []);
  if (ids.size === 0) {
    return all.filter((o) => o.routingHints?.agents?.includes(agent));
  }
  return all.filter((o) => ids.has(o.id));
}

export async function runSpecializedAgents(params: {
  dispatch: PlannerDispatch;
  observations: RecordingObservation[];
  sessionContextBlock: string;
  priorContextBlock: string;
  handlerContext: ToolHandlerContext;
  interactionIds: Record<string, unknown>;
  onUsage?: (usage?: { total_input_tokens?: number; total_output_tokens?: number }) => void;
}): Promise<void> {
  const client = getGeminiClient();

  for (const agent of params.dispatch.agents) {
    const agentObservations = observationsForAgent(
      params.dispatch,
      agent,
      params.observations
    );
    if (agentObservations.length === 0) continue;

    const tools = filterTools(agent);
    if (tools.length === 0) continue;

    const obsBlock = formatObservationsForPrompt(agentObservations);
    const input = `${params.sessionContextBlock}

Materialize these observations using the ${agent} agent tools.
Observations are canonical — transcript is reference only.

Observations:
${obsBlock}

Prior context:
${params.priorContextBlock}`;

    const beforeIds = new Set(params.handlerContext.savedObjectIds ?? []);

    const interaction = await client.interactions.create({
      model: GEMINI_MODELS.specializedAgent,
      input,
      system_instruction: AGENT_PROMPTS[agent],
      tools,
      generation_config: GENERATION_PRESETS.extraction,
      store: true,
    });

    params.interactionIds[agent] = interaction.id;
    params.onUsage?.(interaction.usage);

    await runToolLoop(interaction, {
      tools,
      systemInstruction: AGENT_PROMPTS[agent],
      generationConfig: GENERATION_PRESETS.extraction,
      handlerContext: params.handlerContext,
      model: GEMINI_MODELS.specializedAgent,
      maxTurns: agent === "task" ? 4 : 6,
      onInteractionUsage: params.onUsage,
    });

    const newObjectIds = (params.handlerContext.savedObjectIds ?? []).filter((id) => !beforeIds.has(id));
    if (newObjectIds.length > 0) {
      await markObservationsMaterialized(
        agentObservations.map((o) => o.id),
        newObjectIds
      );
    }
  }
}
