"use client";

import { EnterpriseEmptyState, EnterprisePanel } from "@/components/ui/EnterpriseUI";
import type { OpportunityIntelligencePipelineStage } from "@/lib/opportunities/intelligencePipelinePresentation";

export default function OpportunityIntelligencePipeline({
  opportunityTitle,
  stages,
}: {
  opportunityTitle: string;
  stages: OpportunityIntelligencePipelineStage[];
}) {
  return (
    <EnterprisePanel title="Intelligence Pipeline" eyebrow="Opportunity workflow">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="tex-metric-label">Opportunity</p>
          <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{opportunityTitle}</p>
        </div>
      </div>
      {stages.length ? <div /> : <EnterpriseEmptyState title="No live intelligence stages are connected." detail="Connect the opportunity intelligence source to render the pipeline." />}
    </EnterprisePanel>
  );
}
