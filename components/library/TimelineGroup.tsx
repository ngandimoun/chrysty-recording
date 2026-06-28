"use client";

import type { KnowledgeObject } from "@/types";
import { KnowledgeObjectCard } from "@/components/shared/KnowledgeObjectCard";
import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";

interface TimelineGroupProps {
  label: string;
  objects: KnowledgeObject[];
}

export function TimelineGroup({ label, objects }: TimelineGroupProps) {
  if (objects.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-3"
      >
        {objects.map((object, index) => (
          <KnowledgeObjectCard key={object.id} object={object} index={index} />
        ))}
      </motion.div>
    </section>
  );
}
