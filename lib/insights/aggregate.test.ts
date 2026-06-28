import { describe, expect, it } from "vitest";
import { aggregateInsights } from "@/lib/insights/aggregate";
import type { KnowledgeObjectRow, RecordingSessionRow } from "@/lib/db/types";

describe("aggregateInsights", () => {
  it("returns empty ranked lists when no data", () => {
    const result = aggregateInsights([], []);
    expect(result.mostMentionedPeople).toEqual([]);
    expect(result.documentsGenerated).toBe(0);
    expect(result.attentionStats.created).toBe(0);
  });

  it("counts people and documents", () => {
    const rows: KnowledgeObjectRow[] = [
      {
        id: "ko-person-1",
        type: "person",
        title: "Alice",
        subtitle: null,
        status: null,
        due_at: null,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        source_recording_id: "sess-1",
        mention_count: 2,
        source_quote: null,
        preview_content: null,
        related_object_ids: null,
      },
      {
        id: "ko-doc-1",
        type: "document",
        title: "Summary",
        subtitle: null,
        status: null,
        due_at: null,
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        source_recording_id: "sess-1",
        mention_count: 1,
        source_quote: null,
        preview_content: "Hello",
        related_object_ids: null,
      },
    ];
    const sessions: RecordingSessionRow[] = [
      {
        id: "sess-1",
        status: "completed",
        audio_path: "rk_test/sess-1/audio.webm",
        use_case: "knowledge_capture",
        transcript: null,
        transcript_detail: null,
        gemini_file_uri: null,
        gemini_interaction_ids: null,
        processing_step: 4,
        duration_seconds: 120,
        completed_at: "2026-06-01T10:05:00Z",
        error_message: null,
        created_at: "2026-06-01T10:00:00Z",
        workspace_id: null,
        user_id: null,
        recording_key: "rk_test",
      },
    ];

    const result = aggregateInsights(rows, sessions);
    expect(result.mostMentionedPeople[0]?.label).toBe("Alice");
    expect(result.mostMentionedPeople[0]?.count).toBe(2);
    expect(result.documentsGenerated).toBe(1);
  });
});
