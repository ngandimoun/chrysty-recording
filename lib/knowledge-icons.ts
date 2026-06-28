import type { KnowledgeObjectType } from "@/types";
import {
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
  Lightbulb,
  MapPin,
  Package,
  User,
  type LucideIcon,
} from "lucide-react";

export type TypeIconChartVariant = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";
export type TypeIconBadgeSize = "sm" | "md" | "lg";

export const typeIcons: Record<KnowledgeObjectType, LucideIcon> = {
  document: FileText,
  attention: AlertTriangle,
  person: User,
  place: MapPin,
  idea: Lightbulb,
  company: Building2,
  event: Calendar,
  object: Package,
};

export const typeIconVariant: Record<KnowledgeObjectType, TypeIconChartVariant> = {
  document: "chart-1",
  person: "chart-2",
  company: "chart-2",
  place: "chart-3",
  event: "chart-3",
  idea: "chart-4",
  object: "chart-4",
  attention: "chart-5",
};

/** @deprecated Use KnowledgeTypeIconBadge + typeIconVariant instead */
export const typeAccentClasses: Record<KnowledgeObjectType, string> = {
  document: "cdl-type-icon cdl-type-icon-chart-1",
  attention: "cdl-type-icon cdl-type-icon-chart-5",
  person: "cdl-type-icon cdl-type-icon-chart-2",
  place: "cdl-type-icon cdl-type-icon-chart-3",
  idea: "cdl-type-icon cdl-type-icon-chart-4",
  company: "cdl-type-icon cdl-type-icon-chart-2",
  event: "cdl-type-icon cdl-type-icon-chart-3",
  object: "cdl-type-icon cdl-type-icon-chart-4",
};

const badgeSizeClasses: Record<TypeIconBadgeSize, { container: string; icon: string }> = {
  sm: { container: "size-10", icon: "size-4" },
  md: { container: "size-12", icon: "size-5" },
  lg: { container: "size-14", icon: "size-6" },
};

export function iconSizeForBadge(size: TypeIconBadgeSize = "md") {
  return badgeSizeClasses[size];
}

export function typeIconClassName(type: KnowledgeObjectType): string {
  return `cdl-type-icon cdl-type-icon-${typeIconVariant[type]}`;
}
