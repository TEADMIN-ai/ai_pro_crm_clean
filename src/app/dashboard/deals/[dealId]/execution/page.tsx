import Link from "next/link";
import OpportunityExecutionPanel from "@/components/opportunity-register/OpportunityExecutionPanel";
import { EnterpriseCard, EnterpriseEmptyState, EnterpriseKpiCard, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";

function asText(value: unknown, fallback = "Not captured") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function formatDate(value: string | null) {
  if (!value) return "Missing";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function activityDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  if (typeof value === "string") return formatDate(value);
  return "Time not recorded";
}

export default async function DealExecutionPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  let view: Awaited<ReturnType<typeof getOpportunityExecutionView>>;
  try {
    view = await getOpportunityExecutionView(dealId);
  } catch {
    return <main data-module="dashboard" className="tex-shell"><EnterpriseEmptyState title="Execution workspace unavailable" detail="The canonical deal record could not be loaded." /></main>;
  }

  const title = asText(view.deal.title, dealId);
  const contractor = view.contractor as Record<string, unknown> | null;
  const contractorName = contractor && typeof contractor.companyName === "string" ? contractor.companyName : view.state.contractorName ?? "Unassigned";
  const issuer = asText(view.state.requirements.clientIssuer ?? view.deal.clientName, "Issuer not captured");

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Tender Execution Workspace</p>
            <h1 className="tex-title mt-3">{title}</h1>
            <p className="tex-copy mt-3 text-sm">Opportunity: {issuer}</p>
            <p className="tex-copy mt-1 text-sm">Contractor: {contractorName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnterpriseStatusBadge value={view.state.currentPhase} tone="info" />
            <EnterpriseStatusBadge value={String(view.state.readiness) + "% ready"} tone={view.state.readiness >= 80 ? "success" : "warning"} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <EnterpriseKpiCard label="Closing deadline" value={formatDate(view.state.dueDate)} helper="Tender closing date/time" />
          <EnterpriseKpiCard label="Days remaining" value={view.state.daysRemaining === null ? "Missing" : view.state.daysRemaining} helper="Calendar days to deadline" />
          <EnterpriseKpiCard label="Owner" value={view.state.assignedOwner} helper="Current next-action owner" />
          <EnterpriseKpiCard label="Current phase" value={view.state.currentPhase.replace(/_/g, " ")} helper={view.state.nextAction} />
        </div>
      </EnterpriseCard>

      <OpportunityExecutionPanel dealId={dealId} state={view.state} matches={view.matches} />

      <EnterprisePanel eyebrow="Audit timeline" title="Recent execution activity">
        {view.activity.length ? (
          <div className="grid gap-3">
            {view.activity.map((item) => {
              const record = item as Record<string, unknown>;
              return (
                <div key={String(record.id)} className="rounded-md border border-[color:var(--tex-border)] p-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-[color:var(--tex-text-strong)]">{String(record.message ?? record.type ?? "Activity")}</p>
                    <p className="text-xs text-[color:var(--tex-text-muted)]">{activityDate(record.createdAt)}</p>
                  </div>
                  {record.phase ? <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">Phase: {String(record.phase)}</p> : null}
                </div>
              );
            })}
          </div>
        ) : <EnterpriseEmptyState title="No execution activity yet" detail="Workflow actions will appear here." />}
      </EnterprisePanel>

      <Link href={"/dashboard/opportunity-register/" + dealId} className="tex-action-button tex-action-button--secondary w-fit">Back to opportunity</Link>
    </main>
  );
}
