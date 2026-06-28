import { NextRequest, NextResponse } from "next/server";

import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini/client";
import { GENERATION_PRESETS } from "@/lib/gemini/config";
import { CHRYSTY_VOICE_QA_PROMPT } from "@/lib/gemini/prompts";
import { createAndRunToolLoop } from "@/lib/gemini/run-tool-loop";
import { textToAnswerDocument } from "@/lib/presentation/helpers/answer-document";
import { prepareDocument } from "@/lib/presentation/enrich/normalize";
import { VOICE_QA_TOOLS } from "@/lib/gemini/tools";
import {
  getRecentSessionLanguages,
  getVoiceHistoryThread,
  upsertVoiceHistoryThread,
} from "@/lib/db/queries";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import {
  requireAuthenticatedRecordingIdentity,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";
import type { RecordingIdentity } from "@/lib/recording/resolve-identity";import {
  inferWorkspacePrimaryLanguage,
  localeFromLanguage,
} from "@/lib/processing/session-context";

async function buildVoiceQaSystemInstruction(recordingKey: string): Promise<string> {
  const sessions = await getRecentSessionLanguages(recordingKey);
  const language = await inferWorkspacePrimaryLanguage(
    sessions.map((s) => ({
      primary_language:
        s.primary_language ??
        (typeof s.pipeline_state?.primaryLanguage === "string"
          ? s.pipeline_state.primaryLanguage
          : null),
    }))
  );
  if (language === "und") return CHRYSTY_VOICE_QA_PROMPT;
  return `${CHRYSTY_VOICE_QA_PROMPT}\n\nRespond in the user's language (${language}, locale ${localeFromLanguage(language)}).`;
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAccess(request);
  } catch (error) {
    if (error instanceof PlatformAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let identity: RecordingIdentity;
  try {
    const identityOrResponse = await requireAuthenticatedRecordingIdentity(request, {
      ensureWorkspace: false,
    });
    if (identityOrResponse instanceof NextResponse) return identityOrResponse;
    identity = identityOrResponse;
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    throw error;
  }
  try {
    const body = await request.json();
    const question = body.question as string | undefined;
    const followUp = body.followUp === true;

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemInstruction = await buildVoiceQaSystemInstruction(identity.recordingKey);
    const thread = followUp ? await getVoiceHistoryThread(identity.recordingKey) : null;
    const previousInteractionId = thread?.last_interaction_id;

    if (followUp && previousInteractionId) {
      const client = getGeminiClient();
      const stream = await client.interactions.create({
        model: GEMINI_MODEL,
        input: question,
        previous_interaction_id: previousInteractionId,
        tools: VOICE_QA_TOOLS,
        system_instruction: systemInstruction,
        generation_config: GENERATION_PRESETS.voiceQA,
        stream: true,
        store: true,
      });

      const encoder = new TextEncoder();
      let lastInteractionId = previousInteractionId;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (
                event.event_type === "step.delta" &&
                event.delta?.type === "text" &&
                event.delta.text
              ) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
                );
              }
              if (event.event_type === "interaction.completed" && event.interaction?.id) {
                lastInteractionId = event.interaction.id;
              }
            }
            if (lastInteractionId) {
              await upsertVoiceHistoryThread(identity.recordingKey, lastInteractionId);
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await createAndRunToolLoop({
      input: question,
      tools: VOICE_QA_TOOLS,
      systemInstruction,
      generationConfig: GENERATION_PRESETS.voiceQA,
      handlerContext: { recordingKey: identity.recordingKey },
      previousInteractionId,
    });

    await upsertVoiceHistoryThread(identity.recordingKey, result.lastInteractionId);

    const answerText = result.outputText ?? "I couldn't find an answer in your voice history.";
    const answerDocument = prepareDocument(textToAnswerDocument(answerText, question));

    return new Response(
      JSON.stringify({
        answer: answerText,
        document: answerDocument,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ask failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
