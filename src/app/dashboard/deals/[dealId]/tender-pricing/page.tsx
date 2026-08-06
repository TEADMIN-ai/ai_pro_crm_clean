import Link from "next/link";
import TenderPricingWorkspace from "@/components/tender-pricing/TenderPricingWorkspace";
import { EnterpriseCard, EnterpriseEmptyState, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";
import { requireAuthorizedUserFromSession } from "@/lib/server/authz";

function asText(value: unknown, fallback = "Not captured") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export default async function DealTenderPricingPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  let view: Awaited<ReturnType<typeof getOpportunityExecutionView>>;
  try {
    const actor = await requireAuthorizedUserFromSession();
    view = await getOpportunityExecutionView(dealId, actor);
  } catch {
    return (
      <main data-module="dashboard" className="tex-shell">
        <EnterpriseEmptyState title="Tender pricing workspace unavailable" detail="The canonical deal record could not be loaded." />
      </main>
    );
  }

  const assignment = asRecord(view.deal.contractorAssignment);
  const execution = asRecord(view.deal.opportunityExecution);
  const contractorId = asText(assignment.contractorId ?? execution.contractorId ?? view.deal.contractorId, "");
  const contractorName = asText(assignment.contractorName ?? view.deal.contractorName, "Torque Empire (Pty) Ltd");

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Tender Execution Workspace</p>
            <h1 className="tex-title mt-3">Tender Pricing</h1>
            <p className="tex-copy mt-3 text-sm">Opportunity: {asText(view.deal.title, dealId)}</p>
            <p className="tex-copy mt-1 text-sm">Bidding contractor: {contractorName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnterpriseStatusBadge value={view.state.currentPhase} tone="info" />
            <EnterpriseStatusBadge value={contractorName.includes("Torque Empire") ? "Torque Empire bidder" : "Contractor mismatch"} tone={contractorName.includes("Torque Empire") ? "success" : "danger"} />
          </div>
        </div>
      </EnterpriseCard>

      <TenderPricingWorkspace
        dealId={dealId}
        opportunityId={dealId}
        workspaceId={asText(view.deal.workspaceId, "")}
        contractorId={contractorId}
        contractorName={contractorName}
      />

      <Link href={`/dashboard/deals/${dealId}/execution`} className="tex-action-button tex-action-button--secondary w-fit">
        Back to execution
      </Link>
    </main>
  );
}
