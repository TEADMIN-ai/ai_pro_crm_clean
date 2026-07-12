"use client";

import {
  EnterprisePanel,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";
import type {
  OpportunityIntelligencePipelineStage,
  OpportunityIntelligencePipelineStageStatus,
} from "@/lib/opportunities/intelligencePipelinePresentation";

function toneFromStageStatus(status: OpportunityIntelligencePipelineStageStatus): EnterpriseTone {
  if (status === "complete") return "success";
  if (status === "active") return "info";
  return "pending";
}

function labelFromStageStatus(status: OpportunityIntelligencePipelineStageStatus) {
  if (status === "complete") return "Complete";
  if (status === "active") return "In Progress";
  return "Pending";
}

export default function OpportunityIntelligencePipeline({
  opportunityTitle,
  stages,
}: {
  opportunityTitle: string;
  stages: OpportunityIntelligencePipelineStage[];
}) {
  return (
    <EnterprisePanel
      title="Intelligence Pipeline"
      eyebrow="Opportunity creation workflow"
      action={<EnterpriseStatusBadge tone="neutral" value="Mock data only" />}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="tex-metric-label">Opportunity</p>
          <p className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{opportunityTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnterpriseStatusBadge tone="success" value="No OCR" />
          <EnterpriseStatusBadge tone="success" value="No AI" />
        </div>
      </div>

      <ol className="grid gap-3">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;

          return (
            <li key={stage.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] text-sm font-bold text-[color:var(--tex-text-strong)]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {!isLast ? <span className="mt-2 h-full min-h-6 w-px bg-[color:var(--tex-border)]" aria-hidden="true" /> : null}
              </div>
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--tex-text-strong)]">{stage.label}</p>
                    <p className="tex-copy mt-1 text-sm">{stage.detail}</p>
                  </div>
                  <EnterpriseStatusBadge tone={toneFromStageStatus(stage.status)} value={labelFromStageStatus(stage.status)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </EnterprisePanel>
  );
}
