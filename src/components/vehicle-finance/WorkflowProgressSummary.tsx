"use client";

import Badge from "@/components/ui/Badge";
import type { VehicleFinanceApplication } from "@/types/vehicleFinance";

type Props = { application?: VehicleFinanceApplication | null; className?: string };
const TOTAL = 18;
const tone: Record<string, any> = { completed: "completed", active: "inProgress", waiting: "pending", blocked: "critical" };
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";

export default function WorkflowProgressSummary({ application, className }: Props) {
  const snapshot = application?.workflowSnapshot ?? null;
  const progress = application?.workflowProgressPercentage ?? snapshot?.progressPercentage ?? 0;
  const stage = application?.workflowStageLabel ?? snapshot?.stageLabel ?? "New Application";
  const action = application?.workflowNextRequiredAction ?? snapshot?.nextRequiredAction ?? "Awaiting workflow sync";
  const status = snapshot?.status ?? (application ? "active" : "blocked");
  const completed = snapshot?.completedStageIds?.length ?? 0;
  const steps = Object.keys(snapshot?.stepTimestamps ?? {}).length;

  return (
    <section className={`rounded-2xl border border-sky-400/20 bg-slate-950/70 p-4 ${className ?? ""}`.trim()} aria-label="Workflow progress">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200/80">Next Required Action</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{action}</h3>
          <p className="mt-1 text-sm text-slate-300">Current stage: {stage}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={tone[status] ?? "notStarted"}>{status === "blocked" ? "Critical" : status === "waiting" ? "Pending" : status === "completed" ? "Completed" : "In Progress"}</Badge>
          <Badge tone={progress >= 100 ? "completed" : progress > 0 ? "inProgress" : "notStarted"}>{progress}% complete</Badge>
          <Badge tone={completed >= TOTAL ? "completed" : completed > 0 ? "inProgress" : "notStarted"}>{completed} / {TOTAL} steps</Badge>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/90"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Last Updated</p><p className="mt-2 text-sm font-medium text-slate-100">{fmt(snapshot?.updatedAt ?? application?.updatedAt)}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Step Timestamps</p><p className="mt-2 text-sm font-medium text-slate-100">{steps} recorded</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Stage Tone</p><p className="mt-2 text-sm font-medium text-slate-100 capitalize">{snapshot?.stageTone ?? "grey"}</p></div>
      </div>
    </section>
  );
}
