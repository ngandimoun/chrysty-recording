import type { PipelinePhase } from "@/lib/processing/pipeline-ui";
import { dispatchToQuickPlan, runPlanner } from "@/lib/agents/planner";
import { runObservationAgent } from "@/lib/agents/observation-agent";
import {
  formatRetrievedContextForPrompt,
  retrieveLightweightContext,
  retrievePriorWorld,
} from "@/lib/agents/retrieve-context";
import { runSignificanceScorer } from "@/lib/agents/significance-scorer";
import { runSpecializedAgents } from "@/lib/agents/specialized-agents";
import {
  buildSessionGenerationContext,
  formatSessionContextForPrompt,
  inferPrimaryLanguage,
} from "@/lib/processing/session-context";
import { deleteObservationsForSession } from "@/lib/db/observations";
import {
  enqueueEnrichmentJobs,
  getObjectsBySession,
  getSession,
  updateSession,
} from "@/lib/db/queries";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import {
  CHRYSTY_DOCUMENT_PROMPT,
  TRANSCRIPTION_PROMPT,
  TRANSCRIPTION_PROMPT_WITH_CONTEXT,
} from "@/lib/gemini/prompts";
import {
  flatTranscriptFromSegments,
  transcriptionJsonSchema,
  transcriptionSchema,
} from "@/lib/gemini/schemas";
import { chrystyDocumentJsonSchema } from "@/lib/presentation/schema/gemini-schemas";
import {
  processGeminiDocumentOutput,
  saveKnowledgeObjectPresentation,
} from "@/lib/presentation/save";
import { inferDocumentType } from "@/lib/presentation/design-engine/type-map";
import {
  buildGeminiInputParts,
  formatAttachmentNames,
  uploadAttachmentsForSession,
  type GeminiContextPart,
} from "@/lib/gemini/upload-session-context";
import {
  buildTranscriptionAudioInput,
  prepareSessionAudioForTranscription,
} from "@/lib/gemini/upload-gemini-file";
import { getGeminiClient } from "@/lib/gemini/client";
import {
  accumulateInteractionUsage,
  createTokenUsageTotals,
  type TokenUsageTotals,
} from "@/lib/gemini/usage";
import { type ToolHandlerContext } from "@/lib/gemini/tool-handlers";

export interface FastPipelineOptions {
  sessionId: string;
  onStep?: (step: number) => void | Promise<void>;
}

async function setPipelinePhase(
  sessionId: string,
  phase: PipelinePhase,
  extra: Record<string, unknown> = {}
) {
  const session = await getSession(sessionId);
  const prev = (session?.pipeline_state as Record<string, unknown> | null) ?? {};
  await updateSession(sessionId, {
    pipeline_state: { ...prev, phase, ...extra },
  });
}

function buildDocumentInput(
  docType: string,
  summary: string,
  flatTranscript: string,
  analystSummary: string,
  contextParts: GeminiContextPart[],
  sessionContextBlock: string,
  existingContent?: string,
  changeSummary?: string,
  imageAttachmentIds?: string[]
): string {
  const contextNote =
    contextParts.length > 0
      ? `\n\nAttached context: ${formatAttachmentNames(contextParts)}.`
      : "";
  const updateNote = existingContent
    ? `\n\nEXISTING DOCUMENT (update content — preserve structure where sensible):\n${existingContent.slice(0, 6000)}\n\nChanges to incorporate: ${changeSummary ?? "See transcript."}`
    : "";
  const imageNote =
    imageAttachmentIds && imageAttachmentIds.length > 0
      ? `\n\nInclude an imageGallery block with attachmentIds: ${JSON.stringify(imageAttachmentIds)} for visual context.`
      : "";
  const inferredType = inferDocumentType(docType);

  return `${sessionContextBlock}

Create a ${docType} (documentType: ${inferredType}) from this session.

Transcript summary: ${summary}

Analyst summary (canonical understanding):
${analystSummary}

Transcript:
${flatTranscript}${contextNote}${updateNote}${imageNote}`;
}

export async function runFastPipeline({
  sessionId,
  onStep,
}: FastPipelineOptions): Promise<{ objectCount: number; tokenUsage: TokenUsageTotals }> {
  const client = getGeminiClient();
  const interactionIds: Record<string, unknown> = {};
  const tokenUsage = createTokenUsageTotals();
  const trackUsage = (usage?: { total_input_tokens?: number; total_output_tokens?: number }) =>
    accumulateInteractionUsage(tokenUsage, usage);

  const session = await getSession(sessionId);
  if (!session?.audio_path || !session.recording_key) {
    throw new Error("Session, audio path, or recording key not found");
  }

  const pipelineState = (session.pipeline_state as Record<string, unknown> | null) ?? {};
  const recorderMimeType =
    typeof pipelineState.recorderMimeType === "string"
      ? pipelineState.recorderMimeType
      : undefined;

  await updateSession(sessionId, {
    status: "processing",
    processing_step: 0,
    error_message: null,
    enrichment_status: "pending",
    pipeline_state: { ...pipelineState, phase: "transcribing" as PipelinePhase },
  });
  await onStep?.(0);

  const recordingKey = session.recording_key;

  const transcriptionAudio = await prepareSessionAudioForTranscription(
    session.audio_path,
    recorderMimeType
  );

  const contextParts = await uploadAttachmentsForSession(sessionId);

  const transcriptionPrompt =
    contextParts.length > 0 ? TRANSCRIPTION_PROMPT_WITH_CONTEXT : TRANSCRIPTION_PROMPT;

  const transcriptionInteraction = await client.interactions.create({
    model: GEMINI_MODELS.transcription,
    input: [
      { type: "text", text: transcriptionPrompt },
      buildTranscriptionAudioInput(transcriptionAudio.buffer),
      ...buildGeminiInputParts(contextParts),
    ] as Parameters<typeof client.interactions.create>[0]["input"],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: transcriptionJsonSchema,
    },
    store: true,
  });

  interactionIds.transcription = transcriptionInteraction.id;
  trackUsage(transcriptionInteraction.usage);

  if (!transcriptionInteraction.output_text) {
    throw new Error("Transcription returned empty output");
  }

  const parsed = transcriptionSchema.parse(JSON.parse(transcriptionInteraction.output_text));
  const flatTranscript = flatTranscriptFromSegments(parsed.segments);
  const primaryLanguage = inferPrimaryLanguage(parsed);

  const generationContext = buildSessionGenerationContext(
    {
      ...session,
      transcript_detail: parsed,
      primary_language: primaryLanguage === "und" ? null : primaryLanguage,
    },
    parsed
  );
  const sessionContextBlock = formatSessionContextForPrompt(generationContext);
  const attachmentNote =
    contextParts.length > 0 ? `\nAttached files: ${formatAttachmentNames(contextParts)}` : undefined;

  await updateSession(sessionId, {
    transcript: flatTranscript,
    transcript_detail: parsed,
    processing_step: 1,
    gemini_interaction_ids: interactionIds,
    primary_language: primaryLanguage === "und" ? null : primaryLanguage,
    pipeline_state: {
      ...((session.pipeline_state as Record<string, unknown> | null) ?? {}),
      primaryLanguage,
      clientTimezone: session.client_timezone ?? undefined,
      phase: "observing",
    },
  });
  await onStep?.(1);

  await deleteObservationsForSession(sessionId);

  const priorWorld = await retrievePriorWorld(
    recordingKey,
    sessionId,
    parsed.summary,
    flatTranscript
  );

  const { observations: rawObservations, analystSummary, interactionId: observationInteractionId } =
    await runObservationAgent({
      sessionId,
      recordingKey,
      flatTranscript,
      transcriptSummary: parsed.summary,
      sessionContextBlock,
      priorContext: priorWorld,
      attachmentNote,
      onUsage: trackUsage,
    });

  interactionIds.observation = observationInteractionId;

  await setPipelinePhase(sessionId, "scoring", {
    observationCount: rawObservations.length,
  });

  const scoredObservations = await runSignificanceScorer({
    observations: rawObservations,
    priorObservations: priorWorld.priorObservations,
    analystSummary,
    onUsage: trackUsage,
  });

  interactionIds.significanceScorer = "scored";

  await setPipelinePhase(sessionId, "planning", {
    observationCount: scoredObservations.length,
  });

  const dispatch = await runPlanner({
    observations: scoredObservations,
    analystSummary,
    flatTranscript,
    onUsage: trackUsage,
  });

  interactionIds.planner = dispatch;

  const retrieved = await retrieveLightweightContext(
    recordingKey,
    dispatchToQuickPlan(dispatch),
    sessionId
  );
  const contextBlock = formatRetrievedContextForPrompt(retrieved);

  await setPipelinePhase(sessionId, "materializing", {
    observationCount: scoredObservations.length,
    analystSummary,
    dispatch,
  });

  await updateSession(sessionId, {
    processing_step: 2,
    pipeline_state: {
      phase: "materializing",
      dispatch,
      observationCount: scoredObservations.length,
      analystSummary,
      primaryLanguage,
      clientTimezone: session.client_timezone ?? undefined,
    },
  });
  await onStep?.(2);

  const handlerContext: ToolHandlerContext = {
    sessionId,
    recordingKey,
    clientTimezone: generationContext.timezone,
    savedObjectIds: [],
    documentMeta: new Map(),
  };

  if (dispatch.agents.length > 0) {
    await runSpecializedAgents({
      dispatch,
      observations: scoredObservations,
      sessionContextBlock,
      priorContextBlock: contextBlock,
      handlerContext,
      interactionIds,
      onUsage: trackUsage,
    });
  }

  const documentIds = [...(handlerContext.documentMeta?.keys() ?? [])];
  interactionIds.documents = [];

  if (dispatch.agents.includes("document")) {
    const { getAttachmentsBySession } = await import("@/lib/db/queries");
    const attachments = await getAttachmentsBySession(sessionId);
    const imageAttachmentIds = attachments
      .filter((a) => a.mimeType.startsWith("image/"))
      .map((a) => a.id);

    for (const docId of documentIds) {
      const meta = handlerContext.documentMeta!.get(docId)!;
      const existingDoc = retrieved.existingDocuments.find((d) => d.id === docId);
      const existingPresentation = existingDoc?.presentationDocument
        ? JSON.stringify(existingDoc.presentationDocument)
        : existingDoc?.previewContent;

      const docInteraction = await client.interactions.create({
        model: GEMINI_MODELS.documentUpdate,
        input: buildDocumentInput(
          meta.docType,
          parsed.summary,
          flatTranscript,
          analystSummary,
          contextParts,
          sessionContextBlock,
          existingPresentation,
          meta.updateExisting ? "Incorporate updates from this recording." : undefined,
          imageAttachmentIds.length > 0 ? imageAttachmentIds : undefined
        ),
        system_instruction: CHRYSTY_DOCUMENT_PROMPT,
        generation_config: GENERATION_PRESETS.document,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: chrystyDocumentJsonSchema,
        },
        store: true,
      });
      (interactionIds.documents as string[]).push(docInteraction.id);
      trackUsage(docInteraction.usage);

      if (docInteraction.output_text) {
        const { document, plainText } = processGeminiDocumentOutput(
          docInteraction.output_text,
          meta.docType,
          existingDoc?.title ?? meta.docType
        );

        if (meta.updateExisting) {
          const { executeToolHandler } = await import("@/lib/gemini/tool-handlers");
          await executeToolHandler(
            "update_document",
            {
              objectId: docId,
              content: plainText,
              presentationDocument: document,
              changeSummary: `Updated from session ${sessionId}`,
            },
            handlerContext
          );
        } else {
          await saveKnowledgeObjectPresentation(docId, recordingKey, document);
          const { getLatestDocumentVersionNumber, insertKnowledgeObjectVersion } = await import(
            "@/lib/db/queries"
          );
          const versionNumber = (await getLatestDocumentVersionNumber(docId)) + 1;
          await insertKnowledgeObjectVersion({
            objectId: docId,
            versionNumber,
            content: plainText,
            changeSummary: versionNumber === 1 ? "Initial version" : "Regenerated version",
            sourceRecordingId: sessionId,
            geminiInteractionId: docInteraction.id,
            presentationDocument: document,
          });
        }
      }
    }
  }

  await onStep?.(3);

  const objects = await getObjectsBySession(sessionId);

  await updateSession(sessionId, {
    processing_step: 3,
    status: "completed",
    completed_at: new Date().toISOString(),
    gemini_interaction_ids: interactionIds,
    enrichment_status: "pending",
    pipeline_state: {
      phase: "finishing",
      dispatch,
      observationCount: scoredObservations.length,
      objectCount: objects.length,
      analystSummary,
      primaryLanguage,
      clientTimezone: session.client_timezone ?? undefined,
    },
  });

  await enqueueEnrichmentJobs(sessionId, recordingKey, [
    "index_memory",
    "update_graph",
    "mark_insights_stale",
    "recommendations",
    "cross_analysis",
    "memory_cleanup",
    "embed_observations",
  ]);

  return { objectCount: objects.length, tokenUsage };
}

/** @deprecated Use runFastPipeline */
export async function processRecording(opts: FastPipelineOptions) {
  return runFastPipeline(opts);
}
