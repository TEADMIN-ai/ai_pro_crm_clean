"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { WorkflowStatus } from "@/lib/manus/types/manus.types";

function toneForStatus(status: WorkflowStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "partial" || status === "running" || status === "pending") return "warning";
  if (status === "failed" || status === "rolled_back" || status === "cancelled") return "danger";
  return "neutral";
}

export function WorkflowStatusCard(props: {
  workflowId: string;
  workflowType: string;
  status: WorkflowStatus;
  summary?: string;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Manus Workflow</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{props.workflowType}</h3>
          <p className="mt-1 text-sm text-slate-600">{props.summary ?? "AI orchestration progress is available below."}</p>
        </div>
        <Badge tone={toneForStatus(props.status)}>{props.status}</Badge>
      </div>
      <p className="mt-4 text-xs text-slate-500">Workflow ID: {props.workflowId}</p>
    </Card>
  );
}

export default WorkflowStatusCard;
