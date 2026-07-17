import Link from "next/link";
import TenderIntelligenceWorkspace from "@/components/tender-intelligence/TenderIntelligenceWorkspace";

export default async function DealTenderIntelligencePage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  return (
    <main data-module="dashboard" className="tex-shell">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="tex-eyebrow">Tender Execution Workspace</p>
          <h1 className="text-2xl font-semibold text-[color:var(--tex-text-strong)]">Tender intelligence review</h1>
        </div>
        <Link href={`/dashboard/deals/${dealId}/execution`} className="tex-action-button tex-action-button--secondary w-fit">
          Back to execution
        </Link>
      </div>
      <TenderIntelligenceWorkspace dealId={dealId} />
    </main>
  );
}

