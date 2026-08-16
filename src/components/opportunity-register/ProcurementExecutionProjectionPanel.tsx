"use client";

import { EnterpriseActionButton, EnterpriseKpiCard, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import type { ProcurementExecutionProjection } from "@/lib/opportunities/procurementExecutionProjection";

type Props = { projection: ProcurementExecutionProjection };

function tone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("complete") || value.includes("approved") || value.includes("valid") || value.includes("ready")) return "success" as const;
  if (value.includes("block") || value.includes("missing") || value.includes("failed") || value.includes("expired")) return "danger" as const;
  if (value.includes("not_applicable")) return "neutral" as const;
  return "warning" as const;
}

function statusFrom(score: number | null, blocked: boolean, started: boolean) {
  if (score !== null && score >= 100 && !blocked) return "COMPLETE";
  if (blocked) return "BLOCKED";
  if (started || (score !== null && score > 0)) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function stageRows(projection: ProcurementExecutionProjection) {
  const readiness = projection.readiness;
  const route = (path: string) => path.replace("[dealId]", encodeURIComponent(projection.dealId));
  return [
    { title: "Requirements Review", status: projection.requirementsReviewStatus, progress: projection.tenderAnalysisStatus === "NOT_STARTED" ? 0 : readiness.tenderAnalysisCompleteness, owner: "Staff", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/tender-intelligence"), blockers: projection.intelligenceBlockers },
    { title: "Contractor Assignment", status: projection.assignmentAllowed === true ? "COMPLETE" : projection.contractorIdentityStatus, progress: projection.assignmentAllowed === true ? 100 : 0, owner: "Staff", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/execution"), blockers: projection.assignmentAllowed === true ? [] : projection.blockers.filter((item) => item.problem.includes("bidder") || item.problem.includes("assignment") || item.problem.includes("Contractor")) },
    { title: "Compliance", status: projection.complianceStatus, progress: readiness.generalContractorCompliance, owner: "Compliance", due: projection.dueDate, action: "Open Workspace", href: projection.contractorId ? "/dashboard/contractors/" + encodeURIComponent(projection.contractorId) : route("/dashboard/deals/[dealId]/execution"), blockers: projection.complianceBlockers },
    { title: "Supplier Quotes", status: projection.supplierQuoteStatus, progress: projection.quoteCoverage, owner: "Staff", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/supplier-quotes"), blockers: projection.quoteBlockers },
    { title: "Tender Intelligence", status: projection.tenderAnalysisStatus, progress: readiness.tenderAnalysisCompleteness, owner: "Staff", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/tender-intelligence"), blockers: projection.intelligenceBlockers },
    { title: "BOQ/Pricing", status: projection.pricingStatus, progress: readiness.pricingCompleteness, owner: "QS", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/tender-pricing"), blockers: projection.pricingBlockers },
    { title: "Document Preparation", status: projection.documentPreparationStatus, progress: readiness.documentCompleteness, owner: "Staff", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/document-preparation"), blockers: projection.blockers.filter((item) => /returnable|document|signature|amendment/i.test(item.problem)) },
    { title: "Internal Review", status: projection.reviewStatus, progress: projection.reviewStatus === "complete" ? 100 : 0, owner: "Manager", due: projection.dueDate, action: "Open Workspace", href: "/dashboard/submission-review?dealId=" + encodeURIComponent(projection.dealId), blockers: projection.blockers.filter((item) => /review/i.test(item.problem)) },
    { title: "Tender Pack", status: projection.packStatus, progress: projection.packStatus === "VALIDATED" ? 100 : 0, owner: "Operations", due: projection.dueDate, action: "Open Workspace", href: "/dashboard/tender-pack-requests", blockers: projection.blockers.filter((item) => /pack/i.test(item.problem)) },
    { title: "Submission", status: projection.readinessStatus, progress: projection.readinessScore, owner: "Operations", due: projection.dueDate, action: "Open Workspace", href: route("/dashboard/deals/[dealId]/execution"), blockers: projection.blockers },
  ].map((stage) => ({ ...stage, status: statusFrom(stage.progress, stage.blockers.length > 0, stage.status !== "NOT_STARTED") }));
}

export default function ProcurementExecutionProjectionPanel({ projection }: Props) {
  const stages = stageRows(projection);
  return (
    <div className="grid gap-6">
      <EnterprisePanel eyebrow="Procurement control centre" title={"Next action: " + projection.nextAction.label} action={<EnterpriseStatusBadge value={projection.nextAction.key} tone={projection.nextAction.key === "READY_FOR_SUBMISSION" ? "success" : "warning"} />}>
        <div className="grid gap-4 md:grid-cols-4">
          <EnterpriseKpiCard label="Bidder" value={projection.contractorName ?? "Not assigned"} helper={projection.contractorId ?? "Assign bidder"} />
          <EnterpriseKpiCard label="Tender value" value={projection.totalTenderValue ? "R " + projection.totalTenderValue.toLocaleString("en-ZA") : "Not priced"} helper={projection.grossMargin ? projection.grossMargin + "% margin" : "Margin pending"} />
          <EnterpriseKpiCard label="Owner" value={projection.assignedOwner} helper={projection.dueDate ?? "No due date"} />
          <EnterpriseKpiCard label="Submission readiness" value={projection.readinessScore === null ? projection.readinessStatus : projection.readinessScore + "%"} helper={projection.blockingReasons[0] ?? projection.nextAction.blocker ?? "No blocker"} />
        </div>
        {projection.blockers.length ? (
          <div className="mt-4 grid gap-2">
            {projection.blockers.slice(0, 4).map((item) => (
              <div key={item.problem + item.actionRoute} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-semibold">{item.problem}</p>
                <p>{item.reason} Responsible: {item.responsibleUser}. Due: {item.dueDate ?? "not captured"}.</p>
              </div>
            ))}
          </div>
        ) : null}
        {projection.nextAction.href ? <div className="mt-4"><EnterpriseActionButton href={projection.nextAction.href} variant="success">Open Next Workspace</EnterpriseActionButton></div> : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Operational stages" title="Procurement workflow">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          {stages.map((stage) => (
            <article key={stage.title} className="rounded-md border border-[color:var(--tex-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{stage.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase text-[color:var(--tex-text-muted)]">Owner: {stage.owner}</p>
                </div>
                <EnterpriseStatusBadge value={stage.status} tone={tone(stage.status)} />
              </div>
              <p className="mt-3 text-sm font-semibold">{stage.progress === null ? stage.status : stage.progress + "% complete"}</p>
              <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">Due: {stage.due ?? "Not captured"}</p>
              {stage.blockers[0] ? <p className="mt-3 text-sm text-red-800">{stage.blockers[0].problem}</p> : <p className="mt-3 text-sm text-[color:var(--tex-text-muted)]">No blocker recorded.</p>}
              <div className="mt-4"><EnterpriseActionButton href={stage.href} variant="secondary">{stage.action}</EnterpriseActionButton></div>
            </article>
          ))}
        </div>
      </EnterprisePanel>
    </div>
  );
}
