import type { ReactNode } from "react";
import {
  EnterpriseEmptyState,
  EnterprisePanel,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";

export type OpportunityIntelligenceMetricKey =
  | "pipelineValue"
  | "expectedRevenue"
  | "grossMargin"
  | "submissionReadiness"
  | "activeOpportunities"
  | "awardRate"
  | "contractorReadiness"
  | "complianceHealth"
  | "upcomingClosures"
  | "aiRiskAlerts";

export type OpportunityIntelligenceWidgetDefinition = {
  key: OpportunityIntelligenceMetricKey;
  label: string;
  sourceRequirement: string;
};

export type OpportunityIntelligenceWidgetValue = {
  value: ReactNode;
  detail?: ReactNode;
  tone?: EnterpriseTone;
  status?: "connected" | "unavailable" | "requires-source";
};

export type OpportunityIntelligenceSnapshot = Partial<
  Record<OpportunityIntelligenceMetricKey, OpportunityIntelligenceWidgetValue>
>;

export const opportunityIntelligenceWidgetDefinitions: OpportunityIntelligenceWidgetDefinition[] = [
  {
    key: "pipelineValue",
    label: "Pipeline Value",
    sourceRequirement: "Open opportunity values",
  },
  {
    key: "expectedRevenue",
    label: "Expected Revenue",
    sourceRequirement: "Probability-weighted opportunity values",
  },
  {
    key: "grossMargin",
    label: "Gross Margin",
    sourceRequirement: "Revenue and cost basis",
  },
  {
    key: "submissionReadiness",
    label: "Submission Readiness",
    sourceRequirement: "Tender readiness score",
  },
  {
    key: "activeOpportunities",
    label: "Active Opportunities",
    sourceRequirement: "Open opportunity count",
  },
  {
    key: "awardRate",
    label: "Award Rate",
    sourceRequirement: "Submitted and awarded outcomes",
  },
  {
    key: "contractorReadiness",
    label: "Contractor Readiness",
    sourceRequirement: "Contractor compliance and tender lock state",
  },
  {
    key: "complianceHealth",
    label: "Compliance Health",
    sourceRequirement: "Document verification and expiry posture",
  },
  {
    key: "upcomingClosures",
    label: "Upcoming Closures",
    sourceRequirement: "Opportunity closing dates",
  },
  {
    key: "aiRiskAlerts",
    label: "AI Risk Alerts",
    sourceRequirement: "Persisted risk intelligence signals",
  },
];

function resolveStatusLabel(status: OpportunityIntelligenceWidgetValue["status"] | undefined) {
  if (status === "connected") return "Connected";
  if (status === "unavailable") return "Unavailable";
  return "Requires source";
}

function resolveStatusTone(
  status: OpportunityIntelligenceWidgetValue["status"] | undefined,
  tone: EnterpriseTone | undefined,
): EnterpriseTone {
  if (status === "connected") return tone ?? "success";
  if (status === "unavailable") return "warning";
  return "neutral";
}

export function OpportunityIntelligenceWidget({
  definition,
  metric,
}: {
  definition: OpportunityIntelligenceWidgetDefinition;
  metric?: OpportunityIntelligenceWidgetValue;
}) {
  const status = metric?.status ?? "requires-source";
  const tone = resolveStatusTone(status, metric?.tone);

  return (
    <article className="tex-metric-card">
      <div className="flex items-start justify-between gap-3">
        <p className="tex-metric-label">{definition.label}</p>
        <EnterpriseStatusBadge tone={tone} value={resolveStatusLabel(status)} />
      </div>
      <div className="tex-metric-value mt-3">{metric?.value ?? "--"}</div>
      <p className="tex-copy mt-3 text-sm">
        {metric?.detail ?? definition.sourceRequirement}
      </p>
    </article>
  );
}

export function OpportunityIntelligencePanel({
  snapshot,
  className,
}: {
  snapshot?: OpportunityIntelligenceSnapshot;
  className?: string;
}) {
  return (
    <EnterprisePanel
      title="Opportunity Intelligence"
      eyebrow="Executive pipeline architecture"
      className={className}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {opportunityIntelligenceWidgetDefinitions.map((definition) => (
          <OpportunityIntelligenceWidget
            key={definition.key}
            definition={definition}
            metric={snapshot?.[definition.key]}
          />
        ))}
      </div>
      {!snapshot ? (
        <EnterpriseEmptyState
          className="mt-5"
          title="Opportunity intelligence data source not connected"
          detail="Widgets are registered for the executive surface, but no placeholder opportunity values are rendered."
        />
      ) : null}
    </EnterprisePanel>
  );
}
