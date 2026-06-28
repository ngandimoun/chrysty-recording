import * as z from "zod";

export const transcriptionJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Brief overview of the recording." },
    segments: {
      type: "array",
      description: "Ordered transcript segments with speaker and timing.",
      items: {
        type: "object",
        properties: {
          speaker: { type: "string", description: "Speaker label, e.g. Speaker 1." },
          timestamp: { type: "string", description: "Start time in MM:SS format." },
          content: { type: "string", description: "Verbatim spoken text for this segment." },
          language: { type: "string", description: "Primary language of this segment." },
          emotion: {
            type: "string",
            enum: ["happy", "sad", "angry", "neutral"],
            description: "Primary emotional tone of this segment.",
          },
        },
        required: ["speaker", "timestamp", "content", "emotion"],
      },
    },
  },
  required: ["summary", "segments"],
};

const segmentSchema = z.object({
  speaker: z.string(),
  timestamp: z.string(),
  content: z.string(),
  language: z.string().optional(),
  emotion: z.enum(["happy", "sad", "angry", "neutral"]),
});

export const transcriptionSchema = z.object({
  summary: z.string(),
  segments: z.array(segmentSchema),
});

export type TranscriptionResult = z.infer<typeof transcriptionSchema>;

export function flatTranscriptFromSegments(
  segments: TranscriptionResult["segments"]
): string {
  return segments.map((s) => s.content).join("\n");
}
