import Link from "next/link";
import RequireRole from "@/components/auth/RequireRole";
import GovernanceAlertsPanel from "@/components/governance/alerts/GovernanceAlertsPanel";
import GovernanceDivergenceFeed from "@/components/governance/GovernanceDivergenceFeed";
import GovernanceIntegritySummary from "@/components/governance/GovernanceIntegritySummary";
import GovernanceOverviewPanel from "@/components/governance/GovernanceOverviewPanel";
import GovernanceRouteRiskHeatmap from "@/components/governance/GovernanceRouteRiskHeatmap";
import { getGovernanceAlerts, getRouteAlertSeverityMap } from "@/lib/governance/alerts";
import { persistGovernanceVisibility } from "@/lib/governance/persistence";
import { getGovernanceVisibilitySnapshot } from "@/lib/governance/visibility";
import { hydrateGovernanceAlertsWithWorkflow } from "@/lib/governance/workflows";

export const dynamic = "force-dynamic";

function buildGovernanceSummaryBadge(alertCount: number, severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "CLEAR") {
  if (alertCount === 0) {
    return { label: "Clear", detail: "0 active alerts", toneClassName: "governance-shell-chip-clear" };
  }

  return {
    label: severity,
    detail: `${alertCount} active alert${alertCount === 1 ? "" : "s"}`,
    toneClassName: `governance-shell-chip-${severity.toLowerCase()}`,
  };
}

export default async function GovernanceDashboardPage() {
  const snapshot = getGovernanceVisibilitySnapshot();
  const alerts = getGovernanceAlerts(snapshot);
  const alertsWithWorkflow = await hydrateGovernanceAlertsWithWorkflow(alerts);
  const routeAlertSeverityByKey = getRouteAlertSeverityMap(alerts);
  const governanceSummaryBadge = buildGovernanceSummaryBadge(alerts.length, alerts[0]?.severity ?? "CLEAR");

  persistGovernanceVisibility(snapshot, alerts);

  return (
    <RequireRole allow={["admin", "manager"]}>
      <div className="enterprise-page enterprise-grid governance-page-shell">
        <section className="governance-shell-banner">
          <div>
            <p className="dashboard-eyebrow">Executive Workspace</p>
            <h1 className="governance-shell-title">Governance Operations Console</h1>
            <p className="governance-shell-copy">
              Passive governance visibility is now pinned into the primary workspace shell for executive review.
            </p>
          </div>

          <div className="governance-shell-actions">
            <div className={`governance-shell-chip ${governanceSummaryBadge.toneClassName}`}>
              <span>{governanceSummaryBadge.label}</span>
              <span>{governanceSummaryBadge.detail}</span>
            </div>

            <Link href="/dashboard/deals" className="governance-shell-link">
              Return to Deals
            </Link>
          </div>
        </section>

        <GovernanceOverviewPanel capturedAt={snapshot.capturedAt} kpis={snapshot.kpis} />
        <GovernanceAlertsPanel alerts={alertsWithWorkflow} />
        <GovernanceRouteRiskHeatmap routes={snapshot.routeMetrics} routeAlertSeverityByKey={routeAlertSeverityByKey} />
        <div className="governance-page-columns">
          <GovernanceDivergenceFeed events={snapshot.recentEvents} />
          <GovernanceIntegritySummary
            canonicalActivityRatio={snapshot.canonicalActivityRatio}
            legacyActivityRatio={snapshot.legacyActivityRatio}
            routeClassificationDistribution={snapshot.routeClassificationDistribution}
            driftIndicators={snapshot.driftIndicators}
          />
        </div>
      </div>
    </RequireRole>
  );
}
