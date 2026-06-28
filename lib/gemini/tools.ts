const attentionStatusEnum = ["pending", "waiting", "due", "completed"] as const;

function saveTool(
  name: string,
  type: string,
  extraProperties: Record<string, unknown> = {}
) {
  return {
    type: "function" as const,
    name,
    description: `Save a discovered ${type} knowledge object from the recording.`,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short display title." },
        subtitle: { type: "string", description: "Optional secondary label." },
        sourceQuote: {
          type: "string",
          description: "Verbatim quote from the transcript supporting this item.",
        },
        ...extraProperties,
      },
      required: ["title", "sourceQuote"],
    },
  };
}

export const saveAttentionItemTool = {
  type: "function" as const,
  name: "save_attention_item",
  description: "Save a reminder, todo, or action item discovered in the recording.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "What needs to be done." },
      subtitle: { type: "string", description: "Human-readable due hint, e.g. Tomorrow 9:00." },
      sourceQuote: { type: "string", description: "Verbatim quote from transcript." },
      status: { type: "string", enum: [...attentionStatusEnum] },
      dueAt: { type: "string", description: "ISO 8601 datetime if inferable." },
    },
    required: ["title", "sourceQuote"],
  },
};

export const savePersonTool = saveTool("save_person", "person");
export const savePlaceTool = saveTool("save_place", "place");
export const saveCompanyTool = saveTool("save_company", "company");
export const saveEventTool = saveTool("save_event", "event");
export const saveIdeaTool = saveTool("save_idea", "idea");
export const saveObjectTool = saveTool("save_object", "physical object");

export const saveDocumentTool = {
  type: "function" as const,
  name: "save_document",
  description: "Save a document knowledge object (report, summary, decision log) to generate content for.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Document title." },
      subtitle: { type: "string", description: "Optional subtitle." },
      sourceQuote: { type: "string", description: "Quote that triggered document creation." },
      docType: {
        type: "string",
        description: "Kind of document, e.g. Meeting Summary, Site Inspection Report.",
      },
    },
    required: ["title", "sourceQuote", "docType"],
  },
};

export const linkRelatedObjectsTool = {
  type: "function" as const,
  name: "link_related_objects",
  description: "Link related knowledge objects by their IDs.",
  parameters: {
    type: "object",
    properties: {
      objectId: { type: "string", description: "Primary object ID." },
      relatedObjectIds: {
        type: "array",
        items: { type: "string" },
        description: "IDs of related objects.",
      },
    },
    required: ["objectId", "relatedObjectIds"],
  },
};

export const searchExistingObjectsTool = {
  type: "function" as const,
  name: "search_existing_objects",
  description: "Search existing knowledge objects to avoid duplicates before creating new ones.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Name or keyword to search." },
      type: {
        type: "string",
        enum: ["person", "place", "company", "event", "idea", "object", "attention", "document"],
      },
    },
    required: ["query"],
  },
};

export const resolveEntityTool = {
  type: "function" as const,
  name: "resolve_entity",
  description: "Find an existing entity by title or canonical key before creating a duplicate.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Entity title to match." },
      type: {
        type: "string",
        enum: ["person", "place", "company", "event", "idea", "object", "document", "attention"],
      },
      canonicalKey: { type: "string", description: "Stable slug if known, e.g. project-alpha." },
    },
    required: ["title"],
  },
};

export const updateKnowledgeObjectTool = {
  type: "function" as const,
  name: "update_knowledge_object",
  description: "Update an existing knowledge object instead of creating a duplicate.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Existing object ID." },
      title: { type: "string" },
      subtitle: { type: "string" },
      sourceQuote: { type: "string" },
      attributes: { type: "object", description: "Structured fields to merge, e.g. budget, status." },
    },
    required: ["id"],
  },
};

export const createKnowledgeObjectTool = {
  type: "function" as const,
  name: "create_knowledge_object",
  description: "Create a new knowledge object when resolve_entity found no match.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["person", "place", "company", "event", "idea", "object", "attention", "document"],
      },
      title: { type: "string" },
      subtitle: { type: "string" },
      sourceQuote: { type: "string" },
      canonicalKey: { type: "string" },
      attributes: { type: "object" },
    },
    required: ["type", "title", "sourceQuote"],
  },
};

export const recordChangeTool = {
  type: "function" as const,
  name: "record_change",
  description: "Record what changed between prior state and this recording.",
  parameters: {
    type: "object",
    properties: {
      objectId: { type: "string" },
      fieldName: { type: "string", description: "e.g. budget, status, deadline." },
      previousValue: { type: "string" },
      newValue: { type: "string" },
      changeType: { type: "string", enum: ["update", "create", "complete", "delete"] },
    },
    required: ["fieldName", "newValue"],
  },
};

export const updateDocumentTool = {
  type: "function" as const,
  name: "update_document",
  description: "Create a new version of an existing document with updated content.",
  parameters: {
    type: "object",
    properties: {
      objectId: { type: "string", description: "Existing document object ID." },
      content: { type: "string", description: "Full updated document body (markdown)." },
      changeSummary: { type: "string", description: "Brief summary of what changed in this version." },
    },
    required: ["objectId", "content", "changeSummary"],
  },
};

export const updateAttentionItemTool = {
  type: "function" as const,
  name: "update_attention_item",
  description: "Update an existing todo/reminder instead of creating a duplicate.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Existing attention item ID." },
      title: { type: "string" },
      status: { type: "string", enum: [...attentionStatusEnum] },
      dueAt: { type: "string" },
      subtitle: { type: "string" },
    },
    required: ["id"],
  },
};

export const linkEntitiesTool = {
  type: "function" as const,
  name: "link_entities",
  description: "Create a typed relationship between two entities in the knowledge graph.",
  parameters: {
    type: "object",
    properties: {
      fromObjectId: { type: "string" },
      toObjectId: { type: "string" },
      relationType: {
        type: "string",
        description: "e.g. works_at, member_of, part_of, manages, related_to.",
      },
    },
    required: ["fromObjectId", "toObjectId", "relationType"],
  },
};

export const FAST_EXTRACTION_TOOLS = [
  saveAttentionItemTool,
  updateAttentionItemTool,
  savePersonTool,
  savePlaceTool,
  saveCompanyTool,
  saveEventTool,
  saveIdeaTool,
  saveObjectTool,
  saveDocumentTool,
  resolveEntityTool,
  updateKnowledgeObjectTool,
  createKnowledgeObjectTool,
  recordChangeTool,
  updateDocumentTool,
  linkRelatedObjectsTool,
  linkEntitiesTool,
  searchExistingObjectsTool,
];

export const EXTRACTION_TOOLS = [
  saveAttentionItemTool,
  savePersonTool,
  savePlaceTool,
  saveCompanyTool,
  saveEventTool,
  saveIdeaTool,
  saveObjectTool,
  saveDocumentTool,
  linkRelatedObjectsTool,
  searchExistingObjectsTool,
];

export const searchTranscriptsTool = {
  type: "function" as const,
  name: "search_transcripts",
  description: "Search recording transcripts by keyword.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term." },
      limit: { type: "integer", description: "Max results, default 5." },
    },
    required: ["query"],
  },
};

export const searchKnowledgeObjectsTool = {
  type: "function" as const,
  name: "search_knowledge_objects",
  description: "Search discovered knowledge objects by keyword and optional type.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      type: {
        type: "string",
        enum: ["person", "place", "company", "event", "idea", "object", "attention", "document"],
      },
      limit: { type: "integer" },
    },
  },
};

export const getKnowledgeObjectTool = {
  type: "function" as const,
  name: "get_knowledge_object",
  description: "Get full details of a knowledge object by ID.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Knowledge object ID." },
    },
    required: ["id"],
  },
};

export const listAttentionItemsTool = {
  type: "function" as const,
  name: "list_attention_items",
  description: "List attention items (reminders/todos), optionally filtered by status.",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...attentionStatusEnum] },
    },
  },
};

export const getRecordingSummaryTool = {
  type: "function" as const,
  name: "get_recording_summary",
  description: "Get summary and transcript for a recording session.",
  parameters: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Recording session ID." },
    },
    required: ["sessionId"],
  },
};

export const searchMemoryStoreTool = {
  type: "function" as const,
  name: "search_memory_store",
  description:
    "Semantically search indexed voice transcripts via File Search. Use for paraphrased questions or when keyword search fails.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural language search query." },
      limit: { type: "integer", description: "Max excerpts to return, default 5." },
    },
    required: ["query"],
  },
};

export const searchObservationsTool = {
  type: "function" as const,
  name: "search_observations",
  description:
    "Search structured observations — the canonical understanding of recordings. Use this FIRST before transcripts.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword search." },
      category: { type: "string", description: "Optional category filter." },
      sessionId: { type: "string", description: "Optional session scope." },
      limit: { type: "integer", description: "Max results, default 10." },
    },
  },
};

export const VOICE_QA_TOOLS = [
  searchObservationsTool,
  searchTranscriptsTool,
  searchMemoryStoreTool,
  searchKnowledgeObjectsTool,
  getKnowledgeObjectTool,
  listAttentionItemsTool,
  getRecordingSummaryTool,
];

export type GeminiTool = (typeof EXTRACTION_TOOLS)[number] | (typeof VOICE_QA_TOOLS)[number];
