import { getGeminiClient } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import { executeToolHandler, type ToolHandlerContext } from "@/lib/gemini/tool-handlers";
import type { GoogleGenAI } from "@google/genai";

type CreateParams = Parameters<GoogleGenAI["interactions"]["create"]>[0];
type GeminiTools = NonNullable<CreateParams["tools"]>;

interface FunctionCallStep {
  type: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

interface InteractionLike {
  id: string;
  output_text?: string | null;
  steps?: FunctionCallStep[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number };
}

export interface ToolLoopOptions {
  tools: GeminiTools;
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
  handlerContext: ToolHandlerContext;
  maxTurns?: number;
  model?: string;
  onInteractionUsage?: (usage?: InteractionLike["usage"]) => void;
}

export interface ToolLoopResult {
  outputText: string | null;
  lastInteractionId: string;
}

function getFunctionCalls(steps: FunctionCallStep[] | undefined): FunctionCallStep[] {
  return (steps ?? []).filter((s) => s.type === "function_call" && s.name && s.id);
}

export async function runToolLoop(
  initialInteraction: InteractionLike,
  options: ToolLoopOptions
): Promise<ToolLoopResult> {
  const client = getGeminiClient();
  let interaction = initialInteraction;
  options.onInteractionUsage?.(initialInteraction.usage);
  let turns = 0;
  const maxTurns = options.maxTurns ?? 8;
  const model = options.model ?? GEMINI_MODELS.fastExtraction;

  while (turns < maxTurns) {
    const calls = getFunctionCalls(interaction.steps);
    if (calls.length === 0) {
      return {
        outputText: interaction.output_text ?? null,
        lastInteractionId: interaction.id,
      };
    }

    const functionResults = await Promise.all(
      calls.map(async (call) => {
        try {
          const result = await executeToolHandler(
            call.name!,
            (call.arguments ?? {}) as Record<string, unknown>,
            options.handlerContext
          );
          return {
            type: "function_result" as const,
            name: call.name!,
            call_id: call.id!,
            result: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Tool execution failed";
          return {
            type: "function_result" as const,
            name: call.name!,
            call_id: call.id!,
            result: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          };
        }
      })
    );

    interaction = (await client.interactions.create({
      model,
      previous_interaction_id: interaction.id,
      tools: options.tools,
      system_instruction: options.systemInstruction,
      generation_config: options.generationConfig,
      input: functionResults,
      store: true,
    })) as InteractionLike;

    options.onInteractionUsage?.(interaction.usage);
    turns++;
  }

  return {
    outputText: interaction.output_text ?? null,
    lastInteractionId: interaction.id,
  };
}

export async function createAndRunToolLoop(params: {
  input: string;
  tools: GeminiTools;
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
  handlerContext: ToolHandlerContext;
  previousInteractionId?: string;
  model?: string;
}): Promise<ToolLoopResult> {
  const client = getGeminiClient();
  const interaction = (await client.interactions.create({
    model: params.model ?? GEMINI_MODELS.fastExtraction,
    input: params.input,
    tools: params.tools,
    system_instruction: params.systemInstruction,
    generation_config: params.generationConfig,
    previous_interaction_id: params.previousInteractionId,
    store: true,
  })) as InteractionLike;

  return runToolLoop(interaction, {
    tools: params.tools,
    systemInstruction: params.systemInstruction,
    generationConfig: params.generationConfig,
    handlerContext: params.handlerContext,
    model: params.model,
  });
}
