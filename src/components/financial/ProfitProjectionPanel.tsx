"use client";

import Card from "@/components/ui/Card";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export default function ProfitProjectionPanel() {
  const { data, loading, error } = useEnterpriseKpis();

  return (
    <Card>
      <div style={{ borderRadius: 12, border: "1px solid rgba(109, 182, 255, 0.26)", background: "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))", boxShadow: "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)", padding: 14, fontFamily: "\"Segoe UI\", system-ui, sans-serif", color: "#e7f0ff" }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Opportunity Value Projection</p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading enterprise KPI snapshot...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Pipeline Opportunity Value</p><p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>{formatCurrency(data?.revenue.pipelineValue ?? 0)}</p></div>
            <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Submitted Opportunity Value</p><p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>{formatCurrency(data?.revenue.submittedValue ?? 0)}</p></div>
            <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Awarded or Closed Opportunity Value</p><p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>{formatCurrency(data?.revenue.awardedValue ?? 0)}</p></div>
          </div>
        )}
      </div>
    </Card>
  );
}
