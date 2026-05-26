import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";

type GovernanceKpi = {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  detail: string;
};

export default function GovernanceOverviewPanel({
  capturedAt,
  kpis,
}: {
  capturedAt: string;
  kpis: GovernanceKpi[];
}) {
  return (
    <Card className="governance-hero-card">
      <IdentityCardHeader
        title="Governance Control Surface"
        subtitle="Passive operational visibility across legacy mutations, canonical corrections, and drift signals."
      >
        <Badge tone="info">Captured {new Date(capturedAt).toLocaleTimeString()}</Badge>
        <Badge tone="neutral">Read-only V1</Badge>
      </IdentityCardHeader>

      <div className="enterprise-grid-metrics governance-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="governance-kpi-card">
            <p className="enterprise-metric-label">{kpi.label}</p>
            <div className="governance-kpi-row">
              <h2 className="enterprise-metric-value">{kpi.value}</h2>
              <Badge tone={kpi.tone}>{kpi.tone}</Badge>
            </div>
            <p className="governance-kpi-detail">{kpi.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
