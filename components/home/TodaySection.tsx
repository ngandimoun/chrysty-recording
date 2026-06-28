"use client";

import type { KnowledgeObject, AttentionStatus } from "@/types";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import { AttentionItemCard } from "@/components/home/AttentionItemCard";
import { KnowledgeObjectCard } from "@/components/shared/KnowledgeObjectCard";

interface TodaySectionProps {
  items: KnowledgeObject[];
}

export function TodaySection({ items }: TodaySectionProps) {
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleStatusChange = (id: string, status: AttentionStatus) => {
    setLocalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Today</h2>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-3"
      >
        {localItems.map((item, index) =>
          item.type === "attention" ? (
            <AttentionItemCard
              key={item.id}
              object={item}
              index={index}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <KnowledgeObjectCard key={item.id} object={item} variant="compact" index={index} />
          )
        )}
      </motion.div>
    </section>
  );
}
