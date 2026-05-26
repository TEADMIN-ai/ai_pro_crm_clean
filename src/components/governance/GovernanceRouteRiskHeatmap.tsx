import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";

type GovernanceRouteMetric = {
  routeKey: string;
  sourceName: string;
  routePath: string | null;
  routeClassification: string | null;
  activityFrequency: number;
  divergenceFrequency: number;
  staleStateCompensationFrequency: number;
  canonicalCorrectionFrequency: number;
};

function toneForRisk(metric: GovernanceRouteMetric): "success" | "warning" | "danger" {
  const pressure =
    metric.divergenceFrequency +
    metric.staleStateCompensationFrequency +
    metric.canonicalCorrectionFrequency;

  if (pressure >= 10) return "danger";
  if (pressure >= 4) return "warning";
  return "success";
}

export default function GovernanceRouteRiskHeatmap({
  routes,
  routeAlertSeverityByKey,
}: {
  routes: GovernanceRouteMetric[];
  routeAlertSeverityByKey?: Record<string, "LOW" | "MODERATE" | "HIGH" | "CRITICAL">;
}) {
  function alertTone(severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | undefined): "neutral" | "info" | "warning" | "danger" {
    if (severity === "CRITICAL" || severity === "HIGH") return "danger";
    if (severity === "MODERATE") return "warning";
    if (severity === "LOW") return "info";
    return "neutral";
  }

  return (
    <Card>
      <div className="governance-section-header">
        <div>
          <p className="dashboard-eyebrow">Route Risk Heatmap</p>
          <h2 className="governance-section-title">Highest governance-active routes</h2>
        </div>
        <Badge tone="warning">Read-only route pressure</Badge>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Class</th>
            <th>Activity</th>
            <th>Divergence</th>
            <th>Stale-State</th>
            <th>Corrections</th>
            <th>Risk</th>
            <th>Alert</th>
          </tr>
        </thead>
        <tbody>
          {routes.length === 0 ? (
            <tr>
              <td colSpan={8}>No governance route activity has been observed in this process yet.</td>
            </tr>
          ) : (
            routes.map((route) => (
              <tr key={route.routeKey}>
                <td>
                  <div className="governance-route-cell">
                    <span className="governance-route-name">{route.sourceName}</span>
                    <span className="governance-route-path">{route.routePath ?? "No route path"}</span>
                  </div>
                </td>
                <td><Badge tone="info">{route.routeClassification ?? "unknown"}</Badge></td>
                <td>{route.activityFrequency}</td>
                <td>{route.divergenceFrequency}</td>
                <td>{route.staleStateCompensationFrequency}</td>
                <td>{route.canonicalCorrectionFrequency}</td>
                <td><Badge tone={toneForRisk(route)}>{toneForRisk(route)}</Badge></td>
                <td>
                  <Badge tone={alertTone(routeAlertSeverityByKey?.[`${route.sourceName}|${route.routePath ?? "*"}`])}>
                    {routeAlertSeverityByKey?.[`${route.sourceName}|${route.routePath ?? "*"}`] ?? "none"}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Card>
  );
}
