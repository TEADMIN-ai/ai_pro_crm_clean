import Link from "next/link";
import {
  DashboardCard,
  DashboardShell,
  EmptyState,
  MetricCard,
  ModuleHeader,
  StatusBadge,
} from "@/components/tex/ExecutivePrimitives";
import type { QSCommercialDashboardSummary, QSSupplierRiskLevel, QSTrendDirection } from "@/types/qs";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") return "Insufficient data";
  return `${Math.round(value * 10) / 10}%`;
}

function riskTone(risk: QSSupplierRiskLevel) {
  if (risk === "low") return "success";
  if (risk === "medium") return "warning";
  return "danger";
}

function trendTone(trend: QSTrendDirection) {
  if (trend === "improving") return "success";
  if (trend === "declining") return "danger";
  if (trend === "stable") return "info";
  return "neutral";
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <DashboardCard>
      <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{title}</h2>
      {description ? <p className="tex-copy mt-1 text-sm">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </DashboardCard>
  );
}

export default function QsCommercialIntelligenceDashboard({ summary }: { summary: QSCommercialDashboardSummary }) {
  return (
    <DashboardShell module="qs" focus>
      <div className="max-w-7xl space-y-6">
        <ModuleHeader
          eyebrow="QS Engine Phase 3"
          title="Commercial Intelligence"
          description="Executive view of estimate margin, supplier performance, commercial risk, transport exposure, price movement evidence, recommendation outcomes, and regional supplier signals."
          actions={
            <>
              <Link href="/dashboard/qs/estimates" className="tex-action-button tex-action-button--secondary">Open Estimates</Link>
              <Link href="/dashboard/qs/suppliers" className="tex-action-button">Open Suppliers</Link>
            </>
          }
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Commercial Health" value={`${summary.commercialHealthScore}%`} description="Calculated from margin, missing pricing, supplier ratings, savings, and transport risk." />
          <MetricCard label="Average Margin" value={formatPercent(summary.averageMarginPercentage)} description="Estimate profit divided by total estimate value." />
          <MetricCard label="Missing Pricing" value={summary.missingPricingCount} description="Open pricing warnings across active QS estimates." />
          <MetricCard label="Recommendation Acceptance" value={formatPercent(summary.recommendationAcceptanceRate)} description="Only shown after completed-project feedback is captured." />
        </div>

        {summary.dataGaps.length ? (
          <Panel title="Learning Foundation Data Gaps" description="These gaps limit forecasting confidence. They are shown before any predictive claims are made.">
            <ul className="space-y-2 text-sm text-[color:var(--tex-warning)]">
              {summary.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Supplier Performance Leaderboard" description="Uses latest supplier performance ratings when available, otherwise falls back to supplier profile score.">
            {!summary.supplierPerformanceLeaderboard.length ? (
              <EmptyState title="No supplier records available." description="Create supplier profiles and performance ratings to populate this leaderboard." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tex-table min-w-full">
                  <thead>
                    <tr>{["Supplier", "Score", "Trend"].map((column) => <th key={column} className="px-3 py-3">{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {summary.supplierPerformanceLeaderboard.map((supplier) => (
                      <tr key={supplier.supplierId}>
                        <td className="px-3 py-3 text-[color:var(--tex-text-strong)]">{supplier.supplierName}</td>
                        <td className="px-3 py-3">{supplier.overallSupplierScore}%</td>
                        <td className="px-3 py-3"><StatusBadge tone={trendTone(supplier.trendDirection)}>{supplier.trendDirection}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Savings Opportunities" description="Based on generated commercial impact scenarios with positive savings.">
            {!summary.savingsOpportunities.length ? (
              <EmptyState title="No savings opportunities yet." description="Generate supplier recommendations on estimates to create commercial impact scenarios." action={<Link href="/dashboard/qs/estimates" className="tex-action-button">Generate from Estimate</Link>} />
            ) : (
              <div className="space-y-3">
                {summary.savingsOpportunities.map((opportunity) => (
                  <article key={opportunity.scenarioId} className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[color:var(--tex-text-strong)]">{opportunity.supplierName}</p>
                      <StatusBadge tone="success">{formatCurrency(opportunity.costSaving)} saving</StatusBadge>
                    </div>
                    <p className="tex-copy mt-2 text-sm">Profit impact {formatCurrency(opportunity.profitImpact)} on estimate {opportunity.estimateId}.</p>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Highest Risk Supplier / Material">
            {summary.highestRiskSupplierMaterial ? (
              <div className="space-y-3 text-sm">
                <p className="font-semibold text-[color:var(--tex-text-strong)]">{summary.highestRiskSupplierMaterial.supplierName}</p>
                <p className="tex-copy">{summary.highestRiskSupplierMaterial.materialName}</p>
                <StatusBadge tone={riskTone(summary.highestRiskSupplierMaterial.riskLevel)}>
                  {summary.highestRiskSupplierMaterial.riskLevel} risk | {summary.highestRiskSupplierMaterial.score}% score
                </StatusBadge>
              </div>
            ) : (
              <EmptyState title="No recommendation risk data." description="Supplier recommendations must be generated before this risk card can rank suppliers." />
            )}
          </Panel>

          <Panel title="Transport Risk Summary" description="Uses delivery fee, lead time, branch data, delivery score, and reliability.">
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as QSSupplierRiskLevel[]).map((risk) => (
                <div key={risk} className="rounded-lg border border-[color:var(--tex-border)] p-3 text-center">
                  <p className="text-xl font-semibold text-[color:var(--tex-text-strong)]">{summary.transportRiskSummary[risk]}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--tex-text-muted)]">{risk}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Price Movement Evidence" description="Trend cards require at least three observations per material.">
            {!summary.priceMovementSignals.length ? (
              <EmptyState title="No price observations captured." description="Capture material price observations before showing movement signals." />
            ) : (
              <div className="space-y-2">
                {summary.priceMovementSignals.slice(0, 5).map((signal) => (
                  <div key={signal.materialId} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--tex-border)] p-3 text-sm">
                    <div>
                      <p className="font-semibold text-[color:var(--tex-text-strong)]">{signal.materialName}</p>
                      <p className="tex-copy text-xs">{signal.observationCount} observations | {signal.confidence}</p>
                    </div>
                    <StatusBadge tone={trendTone(signal.trendDirection)}>{signal.confidence === "insufficientData" ? "Insufficient" : `${signal.movementPercentage}%`}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Low Margin Estimates" description="Estimates below 8% margin need commercial review.">
            {!summary.lowMarginEstimates.length ? (
              <EmptyState title="No low-margin estimates detected." />
            ) : (
              <div className="space-y-2">
                {summary.lowMarginEstimates.map((estimate) => (
                  <Link key={estimate.estimateId} href={`/dashboard/qs/estimates/${encodeURIComponent(estimate.estimateId)}`} className="block rounded-lg border border-[color:var(--tex-border)] p-3 no-underline">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[color:var(--tex-text-strong)]">{estimate.projectName ?? estimate.estimateId}</p>
                      <StatusBadge tone="warning">{formatPercent(estimate.marginPercentage)}</StatusBadge>
                    </div>
                    <p className="tex-copy mt-1 text-sm">{formatCurrency(estimate.totalEstimatedProjectValue)}</p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent Commercial Impact Scenarios">
            {!summary.recentCommercialImpactScenarios.length ? (
              <EmptyState title="No recent scenarios." description="Generate supplier recommendations to persist impact scenarios." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tex-table min-w-full">
                  <thead>
                    <tr>{["Supplier", "Saving", "Profit", "Risk"].map((column) => <th key={column} className="px-3 py-3">{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {summary.recentCommercialImpactScenarios.map((scenario) => (
                      <tr key={scenario.scenarioId}>
                        <td className="px-3 py-3 text-[color:var(--tex-text-strong)]">{scenario.supplierName}</td>
                        <td className="px-3 py-3">{formatCurrency(scenario.costSaving)}</td>
                        <td className="px-3 py-3">{formatCurrency(scenario.profitImpact)}</td>
                        <td className="px-3 py-3"><StatusBadge tone={riskTone(scenario.riskImpact)}>{scenario.riskImpact}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Regional Supplier Intelligence" description="Shows cheapest, fastest, and best-rated supplier by region where enough supplier and offer data exists.">
          {!summary.regionalInsights.length ? (
            <EmptyState title="No regional supplier data." description="Add supplier branches, delivery areas, and offers to build regional intelligence." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.regionalInsights.map((region) => (
                <article key={region.region} className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[color:var(--tex-text-strong)]">{region.region}</h3>
                    <StatusBadge tone={region.dataState === "sufficientData" ? "success" : "neutral"}>{region.dataState}</StatusBadge>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="text-[color:var(--tex-text-muted)]">Cheapest</dt><dd>{region.cheapestSupplier ? `${region.cheapestSupplier.supplierName} | ${formatCurrency(region.cheapestSupplier.landedCostExVat)}` : "Insufficient data"}</dd></div>
                    <div><dt className="text-[color:var(--tex-text-muted)]">Fastest</dt><dd>{region.fastestDeliverySupplier ? `${region.fastestDeliverySupplier.supplierName} | ${region.fastestDeliverySupplier.leadTimeDays}d` : "Insufficient data"}</dd></div>
                    <div><dt className="text-[color:var(--tex-text-muted)]">Best rated</dt><dd>{region.bestRatedSupplier ? `${region.bestRatedSupplier.supplierName} | ${region.bestRatedSupplier.score}%` : "Insufficient data"}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}
