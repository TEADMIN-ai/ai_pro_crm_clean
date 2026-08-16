import UploadClient from "./UploadClient";
import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";
import { requireAuthorizedUserFromSession } from "@/lib/server/authz";

type PageProps = {
  params: Promise<{
    dealId: string;
  }>;
};

export default async function UploadPage({ params }: PageProps) {
  const { dealId } = await params;
  const actor = await requireAuthorizedUserFromSession();
  const view = await getOpportunityExecutionView(dealId, actor);
  return <UploadClient dealId={dealId} contractorName={view.state.contractorName} />;
}
