import type { ReactNode } from "react";
import { EnterpriseStatusBadge, type EnterpriseTone } from "@/components/ui/EnterpriseUI";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "completed"
  | "inProgress"
  | "pending"
  | "review"
  | "critical"
  | "notStarted";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneAlias: Record<BadgeTone, EnterpriseTone> = {
  neutral: "neutral",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  completed: "completed",
  inProgress: "inProgress",
  pending: "pending",
  review: "review",
  critical: "critical",
  notStarted: "notStarted",
};

export default function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return <EnterpriseStatusBadge value={children} tone={toneAlias[tone]} className={className} />;
}
