import { notFound } from "next/navigation";
import OpportunityWorkspaceView from "@/components/opportunity-register/OpportunityWorkspaceView";
import { getOpportunityRegisterRecordById } from "@/components/opportunity-register/opportunityRegisterData";

export default function OpportunityRegisterWorkspacePage({
  params,
}: {
  params: { opportunityId: string };
}) {
  const opportunity = getOpportunityRegisterRecordById(params.opportunityId);

  if (!opportunity) {
    notFound();
  }

  return <OpportunityWorkspaceView opportunity={opportunity} />;
}
