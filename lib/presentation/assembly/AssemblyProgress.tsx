"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { springGentle } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AssemblyProgressProps {
  sections: string[];
  completedCount: number;
  loading?: boolean;
  className?: string;
}

export function AssemblyProgress({
  sections,
  completedCount,
  loading = false,
  className,
}: AssemblyProgressProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="cdl-caption text-muted-foreground">
        {loading ? "Generating…" : "Assembled"}
      </p>
      <ul className="space-y-2">
        <AnimatePresence mode="popLayout">
          {sections.map((section, i) => {
            const done = i < completedCount;
            return (
              <motion.li
                key={section}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springGentle}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border",
                    done
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-transparent"
                  )}
                >
                  {done && <Check className="size-3" />}
                </span>
                <span className={cn("cdl-small", done ? "text-foreground" : "text-muted-foreground")}>
                  {section}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
