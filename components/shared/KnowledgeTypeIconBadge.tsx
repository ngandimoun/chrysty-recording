import type { KnowledgeObjectType } from "@/types";
import {
  iconSizeForBadge,
  typeIconClassName,
  typeIcons,
  type TypeIconBadgeSize,
} from "@/lib/knowledge-icons";
import { cn } from "@/lib/utils";

interface KnowledgeTypeIconBadgeProps {
  type: KnowledgeObjectType;
  size?: TypeIconBadgeSize;
  className?: string;
}

export function KnowledgeTypeIconBadge({
  type,
  size = "md",
  className,
}: KnowledgeTypeIconBadgeProps) {
  const Icon = typeIcons[type];
  const { container, icon } = iconSizeForBadge(size);

  return (
    <div className={cn(typeIconClassName(type), container, className)}>
      <Icon className={icon} strokeWidth={2.25} aria-hidden />
    </div>
  );
}
