import type { ReactNode } from "react";
import {
  EnterpriseEmptyState,
  EnterprisePanel,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";

export type OpportunityIntelligenceMetricKey =
  | "revenueForecast"
  | "pipelineForecast"
  | "monthlyWins"
  | "submissionSuccess"
  | "contractorPerformance"
  | "municipalityPerformance"
  | "departmentPerformance"
  | "complianceTrend"
  | "tenderVelocity"
  | "averageSubmissionTime";

export type OpportunityAnalyticsChartKey =
  | "revenueForecast"
  | "pipelineForecast"
  | "performanceBreakdown"
  | "complianceTrend"
  | "tenderVelocity"
  | "opportunityConversionFunnel";

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

export type OpportunityAnalyticsPoint = {
  label: string;
  value: number;
  secondaryValue?: number;
};

export type OpportunityAnalyticsChartDefinition = {
  key: OpportunityAnalyticsChartKey;
  title: string;
  sourceRequirement: string;
  variant: "bar" | "line" | "funnel";
};

export type OpportunityAnalyticsChartSeries = {
  points: OpportunityAnalyticsPoint[];
  status?: "connected" | "unavailable" | "requires-source";
};

export type OpportunityAnalyticsSnapshot = {
  metrics?: OpportunityIntelligenceSnapshot;
  charts?: Partial<Record<OpportunityAnalyticsChartKey, OpportunityAnalyticsChartSeries>>;
};

export const opportunityIntelligenceWidgetDefinitions: OpportunityIntelligenceWidgetDefinition[] = [
  { key: "revenueForecast", label: "Revenue Forecast", sourceRequirement: "Weighted revenue forecast" },
  { key: "pipelineForecast", label: "Pipeline Forecast", sourceRequirement: "Open pipeline forecast" },
  { key: "monthlyWins", label: "Monthly Wins", sourceRequirement: "Awarded opportunities by month" },
  { key: "submissionSuccess", label: "Submission Success", sourceRequirement: "Submitted and successful tender outcomes" },
  { key: "contractorPerformance", label: "Contractor Performance", sourceRequirement: "Contractor opportunity outcomes" },
  { key: "municipalityPerformance", label: "Municipality Performance", sourceRequirement: "Municipality opportunity outcomes" },
  { key: "departmentPerformance", label: "Department Performance", sourceRequirement: "Department opportunity outcomes" },
  { key: "complianceTrend", label: "Compliance Trend", sourceRequirement: "Compliance score over time" },
  { key: "tenderVelocity", label: "Tender Velocity", sourceRequirement: "Tender movement cycle time" },
  { key: "averageSubmissionTime", label: "Average Submission Time", sourceRequirement: "Submission duration history" },
];

export const opportunityAnalyticsChartDefinitions: OpportunityAnalyticsChartDefinition[] = [
  { key: "revenueForecast", title: "Revenue Forecast", sourceRequirement: "Weighted revenue forecast time series", variant: "line" },
  { key: "pipelineForecast", title: "Pipeline Forecast", sourceRequirement: "Open pipeline value time series", variant: "bar" },
  { key: "performanceBreakdown", title: "Contractor, Municipality and Department Performance", sourceRequirement: "Outcome performance by operating dimension", variant: "bar" },
  { key: "complianceTrend", title: "Compliance Trend", sourceRequirement: "Compliance score trend history", variant: "line" },
  { key: "tenderVelocity", title: "Tender Velocity and Submission Time", sourceRequirement: "Tender movement and submission duration trend", variant: "line" },
  { key: "opportunityConversionFunnel", title: "Opportunity Conversion Funnel", sourceRequirement: "Lead, review, submitted, awarded and won counts", variant: "funnel" },
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

function OpportunityAnalyticsChart({ definition, series }: { definition: OpportunityAnalyticsChartDefinition; series?: OpportunityAnalyticsChartSeries }) {
  return (
    <section className="tex-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tex-eyebrow">{definition.variant === "funnel" ? "Conversion" : "Trend"}</p>
          <h3 className="mt-1 font-semibold text-[color:var(--tex-text-strong)]">{definition.title}</h3>
        </div>
        <EnterpriseStatusBadge tone={resolveStatusTone(series?.status, undefined)} value={resolveStatusLabel(series?.status)} />
      </div>
      <EnterpriseEmptyState className="mt-4" title={`${definition.title} source required`} detail={definition.sourceRequirement} />
    </section>
  );
}
export function OpportunityIntelligencePanel({
  snapshot,
  className,
}: {
  snapshot?: OpportunityAnalyticsSnapshot;
  className?: string;
}) {
  return (
    <EnterprisePanel
      title="Executive Opportunity Analytics"
      eyebrow="Presentation layer"
      className={className}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {opportunityIntelligenceWidgetDefinitions.map((definition) => (
          <OpportunityIntelligenceWidget
            key={definition.key}
            definition={definition}
            metric={snapshot?.metrics?.[definition.key]}
          />
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {opportunityAnalyticsChartDefinitions.map((definition) => (
          <OpportunityAnalyticsChart key={definition.key} definition={definition} series={snapshot?.charts?.[definition.key]} />
        ))}
      </div>
      {!snapshot ? (
        <EnterpriseEmptyState
          className="mt-5"
          title="Opportunity analytics data source not connected"
          detail="Executive KPIs and chart containers are registered, but no live opportunity values are connected."
        />
      ) : null}
    </EnterprisePanel>
  );
}










