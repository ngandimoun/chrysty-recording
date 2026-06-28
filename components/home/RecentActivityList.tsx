"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ActivityOutcome } from "@/types";
import { fadeSlideUp, staggerContainer } from "@/lib/motion";
import { ChevronRight } from "lucide-react";

interface RecentActivityListProps {
  items: ActivityOutcome[];
}

export function RecentActivityList({ items }: RecentActivityListProps) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h2>
      <motion.ul
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-1"
      >
        {items.map((item, index) => (
          <motion.li key={item.id} {...fadeSlideUp} transition={{ delay: index * 0.08 }}>
            {item.objectId ? (
              <Link
                href={`/library/${item.objectId}`}
                className="group flex items-center justify-between rounded-2xl px-3 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <span className="block text-foreground">{item.label}</span>
                  {item.sessionSummaryLine && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.sessionSummaryLine}
                    </span>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ) : (
              <div className="px-3 py-3 text-foreground">{item.label}</div>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
