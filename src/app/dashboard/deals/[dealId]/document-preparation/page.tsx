import Link from "next/link";
import { EnterpriseCard, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";
import { requireAuthorizedUserFromSession } from "@/lib/server/authz";

export default async function DocumentPreparationPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const actor = await requireAuthorizedUserFromSession();
  const view = await getOpportunityExecutionView(dealId, actor);
    return <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="p-6"><p className="tex-eyebrow">Document preparation workspace</p><h1 className="tex-title mt-3">Returnables and pack inputs</h1><p className="tex-copy mt-3">Prepare governed tender evidence without completing missing items automatically.</p><div className="mt-4 flex gap-2"><EnterpriseStatusBadge value={view.state.currentPhase} tone="info" /><EnterpriseStatusBadge value={view.state.documentStatus} tone={view.state.documentStatus === "complete" ? "success" : "warning"} /></div></EnterpriseCard>
      <EnterprisePanel eyebrow="Required evidence" title="Returnable checklist"><div className="grid gap-3 md:grid-cols-2">{view.state.documentChecklist.map((item) => <div key={item.key} className="rounded-md border p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{item.label}</h2><EnterpriseStatusBadge value={item.status} tone={item.status === "COMPLETE" ? "success" : "warning"} /></div><p className="mt-2 text-sm text-slate-600">{item.required ? "Required" : "Not applicable"}{item.source ? " - " + item.source : ""}</p><Link className="tex-action-button tex-action-button--secondary mt-3 inline-block" href={"/dashboard/deals/" + dealId + "/upload"}>Upload evidence</Link></div>)}</div></EnterprisePanel>
      <EnterprisePanel eyebrow="Governance" title="Next controlled steps"><ul className="grid gap-2 text-sm"><li>Upload or generate supported returnable evidence.</li><li>Obtain required signatures through the governed approval path.</li><li>Missing evidence remains blocked until reviewed and approved.</li></ul></EnterprisePanel>
      <Link href={"/dashboard/deals/" + dealId + "/execution"} className="tex-action-button tex-action-button--secondary w-fit">Back to Tender Execution</Link>
    </main>;
}
