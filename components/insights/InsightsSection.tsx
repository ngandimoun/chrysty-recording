"use client";

import { motion } from "framer-motion";
import { fadeSlideUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface InsightsSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export function InsightsSection({
  title,
  subtitle,
  children,
  className,
  index = 0,
}: InsightsSectionProps) {
  return (
    <motion.section
      initial={false}
      animate={fadeSlideUp.animate}
      transition={{ delay: index * 0.06 }}
      className={cn(
        "rounded-[20px] border border-border bg-card p-5 shadow-soft",
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}
