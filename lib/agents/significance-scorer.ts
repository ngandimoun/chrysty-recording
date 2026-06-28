import type { AgentName } from "@/lib/agents/types";
import {
  significanceScorerJsonSchema,
  significanceScorerOutputSchema,
} from "@/lib/agents/observation-schema";
import {
  formatObservationsForPrompt,
  updateObservationSignificance,
  type SignificanceUpdate,
} from "@/lib/db/observations";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import { CHRYSTY_SIGNIFICANCE_SCORER_PROMPT } from "@/lib/gemini/prompts";
import type { RecordingObservation } from "@/types";

function defaultScore(obs: RecordingObservation): SignificanceUpdate {
  const agents: AgentName[] = [];
  if (["person", "relationship", "organization", "location"].includes(obs.category)) {
    agents.push("entity");
  }
  if (["event", "timeline"].includes(obs.category)) agents.push("timeline");
  if (obs.category === "commitment") agents.push("task");
  if (["change", "preference", "trend"].includes(obs.category)) agents.push("memory");

  return {
    id: obs.id,
    importance: 0.5,
    shortTermImportance: obs.category === "commitment" ? 0.7 : 0.4,
    confidence: 0.7,
    novelty: obs.changeType === "new" ? 0.8 : 0.3,
    updateExisting: obs.changeType === "updated",
    createNew: obs.changeType === "new",
    needsFollowUp: false,
    needsReminder: obs.category === "commitment",
    needsHumanReview: false,
    routingHints: { agents, priority: "medium" },
  };
}

export async function runSignificanceScorer(params: {
  observations: RecordingObservation[];
  priorObservations: RecordingObservation[];
  analystSummary: string;
  onUsage?: (usage?: { total_input_tokens?: number; total_output_tokens?: number }) => void;
}): Promise<RecordingObservation[]> {
  if (params.observations.length === 0) return [];

  let updates: SignificanceUpdate[] = params.observations.map(defaultScore);

  const client = getGeminiClient();
  const input = `Analyst summary: ${params.analystSummary}

Current session observations (score each by observationIndex):
${params.observations.map((o, i) => `[${i}] (${o.category}) ${o.title}: ${o.body}`).join("\n")}

Prior observations for novelty comparison:
${formatObservationsForPrompt(params.priorObservations.slice(0, 20))}`;

  try {
    const interaction = await client.interactions.create({
      model: GEMINI_MODELS.significanceScorer,
      input,
      system_instruction: CHRYSTY_SIGNIFICANCE_SCORER_PROMPT,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: significanceScorerJsonSchema,
      },
      generation_config: { ...GENERATION_PRESETS.extraction, thinking_level: "low", temperature: 0.1 },
      store: false,
    });

    params.onUsage?.(interaction.usage);

    if (interaction.output_text) {
      const parsed = significanceScorerOutputSchema.parse(JSON.parse(interaction.output_text));
      updates = parsed.scores.map((s) => {
        const obs = params.observations[s.observationIndex];
        if (!obs) return defaultScore(params.observations[0]);
        return {
          id: obs.id,
          importance: s.importance,
          shortTermImportance: s.shortTermImportance,
          confidence: s.confidence,
          novelty: s.novelty,
          updateExisting: s.updateExisting,
          createNew: s.createNew,
          needsFollowUp: s.needsFollowUp,
          needsReminder: s.needsReminder,
          needsHumanReview: s.needsHumanReview,
          routingHints: {
            agents: s.routingAgents as AgentName[],
            priority:
              s.importance >= 0.7 ? "high" : s.importance >= 0.4 ? "medium" : "low",
          },
        };
      });
    }
  } catch {
    /* keep defaults */
  }

  await updateObservationSignificance(updates);

  const byId = new Map(updates.map((u) => [u.id, u]));
  return params.observations.map((obs) => {
    const score = byId.get(obs.id) ?? defaultScore(obs);
    return {
      ...obs,
      importance: score.importance,
      shortTermImportance: score.shortTermImportance,
      confidence: score.confidence,
      novelty: score.novelty,
      updateExisting: score.updateExisting,
      createNew: score.createNew,
      needsFollowUp: score.needsFollowUp,
      needsReminder: score.needsReminder,
      needsHumanReview: score.needsHumanReview,
      routingHints: score.routingHints,
    };
  });
}
