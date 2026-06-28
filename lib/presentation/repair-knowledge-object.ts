import { getKnowledgeObjectDb } from "@/lib/db/queries";
import { attemptPresentationRepair } from "@/lib/presentation";
import { repairKnowledgeObjectPresentation } from "@/lib/presentation/save";
import type { KnowledgeObject } from "@/types";

export async function withRepairedPresentation(
  object: KnowledgeObject,
  recordingKey: string
): Promise<KnowledgeObject> {
  const repaired = attemptPresentationRepair(
    object.attributes,
    object.previewContent,
    object.presentationDocument
  );
  if (!repaired) return object;

  await repairKnowledgeObjectPresentation(object.id, recordingKey, repaired);

  const refreshed = await getKnowledgeObjectDb(object.id, recordingKey);
  return refreshed ?? {
    ...object,
    presentationDocument: repaired,
  };
}

export async function repairKnowledgeObjects(
  objects: KnowledgeObject[],
  recordingKey: string
): Promise<KnowledgeObject[]> {
  return Promise.all(objects.map((obj) => withRepairedPresentation(obj, recordingKey)));
}
