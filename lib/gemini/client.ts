import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODELS } from "@/lib/gemini/models";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** @deprecated Use GEMINI_MODELS from lib/gemini/models.ts */
export const GEMINI_MODEL = GEMINI_MODELS.default;
