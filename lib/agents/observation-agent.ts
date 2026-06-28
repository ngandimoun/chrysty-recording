import { toCanonicalKey } from "@/lib/agents/canonical-key";
import {
  observationAgentJsonSchema,
  observationAgentOutputSchema,
  type RawObservation,
} from "@/lib/agents/observation-schema";
import type { RetrievedContext } from "@/lib/agents/types";
import {
  findPriorObservationByCanonicalKey,
  insertObservations,
} from "@/lib/db/observations";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import { CHRYSTY_OBSERVATION_PROMPT } from "@/lib/gemini/prompts";
import type { RecordingObservation } from "@/types";

export interface RunObservationAgentParams {
  sessionId: string;
  recordingKey: string;
  flatTranscript: string;
  transcriptSummary: string;
  sessionContextBlock: string;
  priorContext: RetrievedContext;
  attachmentNote?: string;
  onUsage?: (usage?: { total_input_tokens?: number; total_output_tokens?: number }) => void;
}

function formatPriorContextForObservation(ctx: RetrievedContext): string {
  const parts: string[] = [];
  if (ctx.priorObservations.length > 0) {
    parts.push(
      "Prior observations (may need updating):",
      ...ctx.priorObservations.slice(0, 30).map(
        (o) =>
          `- [${o.category}] ${o.title}: ${o.body}${o.canonicalKey ? ` (key: ${o.canonicalKey})` : ""}`
      )
    );
  }
  if (ctx.relatedObjects.length > 0) {
    parts.push(
      "Known entities:",
      ...ctx.relatedObjects.slice(0, 15).map((o) => `- [${o.type}] ${o.title}`)
    );
  }
  if (ctx.memoryExcerpts.length > 0) {
    parts.push(
      "Prior session excerpts:",
      ...ctx.memoryExcerpts.slice(0, 3).map((m) => `- ${m.excerpt.slice(0, 250)}`)
    );
  }
  return parts.length > 0 ? parts.join("\n") : "No prior world model — first observations.";
}

async function resolveSupersedes(
  recordingKey: string,
  raw: RawObservation
): Promise<{ changeType: RawObservation["changeType"]; supersedesId?: string }> {
  const key = raw.canonicalKey ?? (raw.title.length > 2 ? toCanonicalKey(raw.title) : undefined);
  if (!key) return { changeType: raw.changeType ?? "new" };
  const prior = await findPriorObservationByCanonicalKey(recordingKey, key);
  if (!prior) return { changeType: raw.changeType ?? "new", supersedesId: undefined };
  if (raw.changeType === "removed") return { changeType: "removed", supersedesId: prior.id };
  if (raw.changeType === "reaffirmed") return { changeType: "reaffirmed", supersedesId: prior.id };
  return { changeType: "updated", supersedesId: prior.id };
}

export async function runObservationAgent(
  params: RunObservationAgentParams
): Promise<{ observations: RecordingObservation[]; analystSummary: string; interactionId: string }> {
  const client = getGeminiClient();
  const priorBlock = formatPriorContextForObservation(params.priorContext);

  const input = `${params.sessionContextBlock}

Observe this recording and build an accurate model of the user's world.

Transcript summary: ${params.transcriptSummary}

Transcript:
${params.flatTranscript}

Prior world model:
${priorBlock}
${params.attachmentNote ?? ""}`;

  const interaction = await client.interactions.create({
    model: GEMINI_MODELS.observation,
    input,
    system_instruction: CHRYSTY_OBSERVATION_PROMPT,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: observationAgentJsonSchema,
    },
    generation_config: GENERATION_PRESETS.extraction,
    store: true,
  });

  params.onUsage?.(interaction.usage);

  if (!interaction.output_text) {
    throw new Error("Observation agent returned empty output");
  }

  const parsed = observationAgentOutputSchema.parse(JSON.parse(interaction.output_text));

  const insertParams = await Promise.all(
    parsed.observations.map(async (raw) => {
      const canonicalKey =
        raw.canonicalKey ?? (raw.title.length > 2 ? toCanonicalKey(raw.title) : undefined);
      const { changeType, supersedesId } = await resolveSupersedes(params.recordingKey, {
        ...raw,
        canonicalKey,
      });
      return {
        recordingKey: params.recordingKey,
        sessionId: params.sessionId,
        category: raw.category,
        title: raw.title,
        body: raw.body,
        sourceQuote: raw.sourceQuote,
        sourceTimestamp: raw.sourceTimestamp,
        changeType,
        canonicalKey,
        supersedesId,
        affectedEntityKeys: raw.affectedEntityKeys,
        attributes: raw.attributes,
        geminiInteractionId: interaction.id,
      };
    })
  );

  const observations = await insertObservations(insertParams);

  return {
    observations,
    analystSummary: parsed.analystSummary,
    interactionId: interaction.id,
  };
}
