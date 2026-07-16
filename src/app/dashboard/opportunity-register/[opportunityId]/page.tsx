import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseStatusBadge,
} from "@/components/ui/EnterpriseUI";
import OpportunityWorkspaceView from "@/components/opportunity-register/OpportunityWorkspaceView";
import { getDealById } from "@/server/services/dealService";
import { getOpportunityRegisterRecordById, mapDealToOpportunityRegisterRecord } from "@/components/opportunity-register/opportunityRegisterData";

export default async function OpportunityRegisterDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const staticOpportunity = getOpportunityRegisterRecordById(opportunityId);

  if (staticOpportunity) {
    return <OpportunityWorkspaceView opportunity={staticOpportunity} />;
  }

  const deal = await getDealById(opportunityId);
  if (deal) {
    return <OpportunityWorkspaceView opportunity={mapDealToOpportunityRegisterRecord(deal)} />;
  }

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Opportunity Register</p>
              <h1 className="tex-title mt-3">Opportunity Workspace</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                No production opportunity record is connected for ID {opportunityId}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Deep link resolved" tone="success" />
              <EnterpriseStatusBadge value="Record unavailable" tone="neutral" />
            </div>
          </div>
        </div>
      </EnterpriseCard>

      <EnterpriseEmptyState
        title="No opportunity record found."
        detail="The route is available for refresh and deep links. Create the production opportunity record to render workspace details."
      />

      <div>
        <EnterpriseActionButton href="/dashboard/opportunity-register" variant="secondary">
          Back to Opportunity Register
        </EnterpriseActionButton>
      </div>
    </main>
  );
}
