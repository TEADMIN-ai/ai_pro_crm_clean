"use client";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import type { VehicleFinanceApplication, VehicleFinanceDocument } from "@/types/vehicleFinance";
import { getVehicleFinanceDocumentLabel, VEHICLE_FINANCE_DOCUMENT_TYPES } from "@/types/vehicleFinance";

type Props = {
  application?: VehicleFinanceApplication | null;
  documents?: VehicleFinanceDocument[];
  timelineEventCount?: number;
};

function formatChecklistCompletion(received: number, verified: number): string {
  const total = VEHICLE_FINANCE_DOCUMENT_TYPES.length || 1;
  return `${Math.round((verified / total) * 100)}%`;
}

export default function VehicleFinanceApplicationOperationsPanel({ application, documents = [], timelineEventCount = 0 }: Props) {
  const snapshot = application?.workflowSnapshot ?? null;
  const requiredDocuments = VEHICLE_FINANCE_DOCUMENT_TYPES.map((documentType) => {
    const document = documents.find((item) => item.documentType === documentType) ?? null;
    const integrity = typeof (document?.aiAnalysis as Record<string, unknown> | undefined)?.documentIntegrityScore === "number"
      ? Number((document?.aiAnalysis as Record<string, unknown> & { documentIntegrityScore?: number } | undefined)?.documentIntegrityScore ?? 0)
      : 0;
    const verified = Boolean(document) && integrity >= 70;
    return {
      documentType,
      label: getVehicleFinanceDocumentLabel(documentType),
      received: Boolean(document),
      verified,
    };
  });

  const receivedCount = requiredDocuments.filter((item) => item.received).length;
  const verifiedCount = requiredDocuments.filter((item) => item.verified).length;
  const outstandingCount = requiredDocuments.filter((item) => !item.received || !item.verified).length;
  const assignmentLabel = application?.assignedConsultantName ?? snapshot?.assignedConsultantName ?? "Unassigned";

  return (
    <Card className="border-sky-300/10 bg-slate-950/70">
      <IdentityCardHeader title="Application Workspace" subtitle="Ownership, workflow, checklist, and task visibility." />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned Consultant</p>
          <p className="mt-3 text-sm font-semibold text-white">{assignmentLabel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next Required Action</p>
          <p className="mt-3 text-sm font-semibold text-white">{application?.workflowNextRequiredAction ?? snapshot?.nextRequiredAction ?? "Awaiting workflow sync"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Checklist</p>
          <p className="mt-3 text-sm font-semibold text-white">{formatChecklistCompletion(receivedCount, verifiedCount)}</p>
          <p className="mt-1 text-xs text-slate-400">{verifiedCount} verified / {outstandingCount} outstanding</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Timeline</p>
          <p className="mt-3 text-sm font-semibold text-white">{timelineEventCount} events</p>
          <p className="mt-1 text-xs text-slate-400">{snapshot?.stageLabel ?? "New Application"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Staff Ownership</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["Consultant", application?.assignedConsultantName ?? snapshot?.assignedConsultantName ?? "Unassigned"],
              ["Sales Manager", application?.assignedSalesManagerName ?? "Unassigned"],
              ["Finance Manager", application?.assignedFinanceManagerName ?? "Unassigned"],
              ["Workflow Stage", application?.workflowStageLabel ?? snapshot?.stageLabel ?? "New Application"],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-medium text-white">{value as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist Items</p>
          <div className="mt-3 grid gap-2">
            {requiredDocuments.map((item) => (
              <div key={item.documentType} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-sm text-slate-100">{item.label}</span>
                <Badge tone={item.verified ? "completed" : item.received ? "review" : "notStarted"}>{item.verified ? "Verified" : item.received ? "Received" : "Outstanding"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
