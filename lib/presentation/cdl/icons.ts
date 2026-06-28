import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle,
  CheckSquare,
  DollarSign,
  MapPin,
  User,
} from "lucide-react";

export type SectionIconKey =
  | "summary"
  | "people"
  | "location"
  | "tasks"
  | "timeline"
  | "decisions"
  | "photos"
  | "references"
  | "metrics"
  | "companies";

export const sectionIcons: Record<SectionIconKey, LucideIcon> = {
  summary: BookOpen,
  people: User,
  location: MapPin,
  tasks: CheckSquare,
  timeline: ArrowRight,
  decisions: CheckCircle,
  photos: Camera,
  references: BookOpen,
  metrics: DollarSign,
  companies: User,
};

export function iconForBlockType(type: string): LucideIcon | null {
  switch (type) {
    case "summary":
    case "paragraph":
      return BookOpen;
    case "people":
      return User;
    case "companies":
      return User;
    case "checklist":
      return CheckSquare;
    case "timeline":
      return ArrowRight;
    case "decisions":
      return CheckCircle;
    case "imageGallery":
      return Camera;
    case "references":
      return BookOpen;
    case "metrics":
      return DollarSign;
    default:
      return null;
  }
}
