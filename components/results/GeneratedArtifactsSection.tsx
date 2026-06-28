"use client";

import { KnowledgeObjectCard } from "@/components/shared/KnowledgeObjectCard";
import type { KnowledgeObject } from "@/types";

interface GeneratedArtifactsSectionProps {
  objects: KnowledgeObject[];
}

export function GeneratedArtifactsSection({ objects }: GeneratedArtifactsSectionProps) {
  if (objects.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">What we created</h2>
        <p className="text-sm text-muted-foreground">
          {objects.length} update{objects.length === 1 ? "" : "s"} materialized from your
          observations.
        </p>
      </div>
      <div className="space-y-4">
        {objects.map((object, index) => (
          <KnowledgeObjectCard key={object.id} object={object} index={index} />
        ))}
      </div>
    </section>
  );
}
