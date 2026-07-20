"use client";

import Card from "@/components/ui/Card";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export default function ExecutiveSummaryPanel() {
  const { data, loading, error } = useEnterpriseKpis();
  const summary = data
    ? "Enterprise KPI service is supplying the executive operating snapshot."
    : "Enterprise KPI service snapshot is pending.";

  return (
    <Card>
      <div style={{ borderRadius: 12, border: "1px solid rgba(109, 182, 255, 0.26)", background: "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))", boxShadow: "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)", padding: 14, fontFamily: "\"Segoe UI\", system-ui, sans-serif", color: "#e7f0ff" }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Executive Operating Summary</p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading enterprise KPI snapshot...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Visible Contractors</p><p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>{data?.contractors.total ?? 0}</p></div>
              <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Visible Opportunities</p><p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>{data?.dashboardSummary.totalOpportunities ?? 0}</p></div>
              <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Total Opportunity Value</p><p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>{formatCurrency(data?.revenue.totalValue ?? 0)}</p></div>
              <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Documents</p><p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>{data?.documents.total ?? 0}</p></div>
              <div><p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Valid Compliance Documents</p><p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>{data?.compliance.valid ?? 0}</p></div>
            </div>
            <p style={{ margin: "12px 0 0", color: "#cae0ff", fontSize: 13 }}>{summary}</p>
          </>
        )}
      </div>
    </Card>
  );
}
