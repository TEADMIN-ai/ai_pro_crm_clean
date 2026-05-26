import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

type DistributionItem = {
  classification: string;
  count: number;
};

type DriftIndicator = {
  label: string;
  value: number;
};

export default function GovernanceIntegritySummary({
  canonicalActivityRatio,
  legacyActivityRatio,
  routeClassificationDistribution,
  driftIndicators,
}: {
  canonicalActivityRatio: number;
  legacyActivityRatio: number;
  routeClassificationDistribution: DistributionItem[];
  driftIndicators: DriftIndicator[];
}) {
  return (
    <Card>
      <div className="governance-section-header">
        <div>
          <p className="dashboard-eyebrow">Canonical Integrity Summary</p>
          <h2 className="governance-section-title">Passive integrity distribution</h2>
        </div>
        <Badge tone="success">No writeback controls</Badge>
      </div>

      <div className="governance-integrity-grid">
        <div className="governance-integrity-panel">
          <p className="enterprise-metric-label">Canonical Activity Ratio</p>
          <h2 className="enterprise-metric-value">{(canonicalActivityRatio * 100).toFixed(1)}%</h2>
          <p className="governance-kpi-detail">Share of recent tracked activity classified as canonical.</p>
        </div>

        <div className="governance-integrity-panel">
          <p className="enterprise-metric-label">Legacy Activity Ratio</p>
          <h2 className="enterprise-metric-value">{(legacyActivityRatio * 100).toFixed(1)}%</h2>
          <p className="governance-kpi-detail">Share of recent tracked activity classified as legacy.</p>
        </div>
      </div>

      <div className="governance-integrity-columns">
        <div className="governance-integrity-panel">
          <p className="enterprise-metric-label">Route Classification Distribution</p>
          <div className="governance-distribution-list">
            {routeClassificationDistribution.length === 0 ? (
              <p className="governance-kpi-detail">No recent route classifications observed.</p>
            ) : (
              routeClassificationDistribution.map((item) => (
                <div key={item.classification} className="governance-distribution-row">
                  <Badge tone="info">{item.classification}</Badge>
                  <span>{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="governance-integrity-panel">
          <p className="enterprise-metric-label">Governance Drift Indicators</p>
          <div className="governance-distribution-list">
            {driftIndicators.map((item) => (
              <div key={item.label} className="governance-distribution-row">
                <span className="governance-route-name">{item.label}</span>
                <Badge tone={item.value >= 6 ? "danger" : item.value >= 3 ? "warning" : "success"}>
                  {item.value}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
