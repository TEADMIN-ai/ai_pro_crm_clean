"use client";

import { EnterpriseStatusBadge, type EnterpriseTone } from "@/components/ui/EnterpriseUI";

type Status = "READY" | "RISK" | "BLOCKED";

type StatusBadgeProps = {
  status: Status;
};

const toneByStatus: Record<Status, EnterpriseTone> = {
  READY: "success",
  RISK: "warning",
  BLOCKED: "danger",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <EnterpriseStatusBadge value={status} tone={toneByStatus[status]} />;
}
