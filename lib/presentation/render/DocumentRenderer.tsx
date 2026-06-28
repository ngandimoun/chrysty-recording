"use client";

import { motion } from "framer-motion";
import type { ResolvedDocument } from "@/lib/presentation/design-engine/resolve";
import { BlockRenderer } from "@/lib/presentation/render/BlockRenderer";
import { CDL_SPACE } from "@/lib/presentation/cdl";
import { fadeSlideUp, staggerContainer } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DocumentRendererProps {
  resolved: ResolvedDocument;
  updatedAt?: string;
  animate?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
  className?: string;
}

export function DocumentRenderer({
  resolved,
  updatedAt,
  animate = true,
  compact = false,
  hideTitle = false,
  className,
}: DocumentRendererProps) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const { document, theme, themeConfig, orderedBlocks } = resolved;

  const knownNames = orderedBlocks.flatMap((b) =>
    b.type === "people" ? b.people.map((p) => p.name) : []
  );

  let sectionCounter = 0;

  return (
    <article
      className={cn("cdl-document mx-auto w-full", className)}
      data-document-theme={theme}
      style={{ maxWidth: compact ? "100%" : "42rem" }}
    >
      <header style={{ marginBottom: hideTitle ? 0 : CDL_SPACE.md }}>
        {!hideTitle && (
          <>
            <h1
              className={themeConfig.titleScale === "display" ? "cdl-display" : "cdl-title"}
            >
              {document.title}
            </h1>
            {document.subtitle && (
              <p className="cdl-small mt-2 text-muted-foreground">{document.subtitle}</p>
            )}
            {updatedAt && (
              <p className="cdl-caption mt-2">Updated {formatRelativeTime(updatedAt)}</p>
            )}
          </>
        )}
      </header>

      {!hideTitle && <div className="cdl-divider mb-6" />}

      <motion.div
        variants={shouldAnimate ? staggerContainer : undefined}
        initial={shouldAnimate ? "initial" : undefined}
        animate={shouldAnimate ? "animate" : undefined}
        className="space-y-8"
        style={{ gap: themeConfig.sectionSpacing }}
      >
        {orderedBlocks.map((block, index) => {
          const hasSectionTitle =
            block.type !== "paragraph" &&
            block.type !== "quote" &&
            block.type !== "callout" &&
            block.type !== "clause" &&
            block.type !== "code";
          if (hasSectionTitle) sectionCounter += 1;

          const content = (
            <BlockRenderer
              block={block}
              themeConfig={themeConfig}
              sectionIndex={hasSectionTitle ? sectionCounter : undefined}
              knownNames={knownNames}
            />
          );

          if (!shouldAnimate) {
            return <div key={`${block.type}-${index}`}>{content}</div>;
          }

          return (
            <motion.div key={`${block.type}-${index}`} variants={fadeSlideUp}>
              {content}
            </motion.div>
          );
        })}
      </motion.div>
    </article>
  );
}
