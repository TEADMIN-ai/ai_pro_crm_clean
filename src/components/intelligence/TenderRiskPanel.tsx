"use client";

import type { TenderRiskRadarResult } from "@/lib/intelligence/tenderRiskRadar";

type TenderRiskPanelProps = {
  risk: TenderRiskRadarResult;
};

const riskTone = {
  LOW: {
    border: "rgba(34,197,94,0.45)",
    glow: "0 0 14px rgba(34,197,94,0.45)",
    badge: "#22c55e",
  },
  MEDIUM: {
    border: "rgba(250,204,21,0.45)",
    glow: "0 0 14px rgba(250,204,21,0.45)",
    badge: "#facc15",
  },
  HIGH: {
    border: "rgba(249,115,22,0.5)",
    glow: "0 0 16px rgba(249,115,22,0.5)",
    badge: "#f97316",
  },
  CRITICAL: {
    border: "rgba(239,68,68,0.55)",
    glow: "0 0 18px rgba(239,68,68,0.6)",
    badge: "#ef4444",
  },
} as const;

export default function TenderRiskPanel({ risk }: TenderRiskPanelProps) {
  const tone = riskTone[risk.riskLevel];
  const isCritical = risk.riskLevel === "CRITICAL";

  return (
    <section
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 14,
        padding: 16,
        background: "#0F172A",
        marginBottom: 20,
        boxShadow: tone.glow,
        animation: isCritical ? "tender-risk-pulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Tender Risk Radar</h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.45,
            textTransform: "uppercase",
            borderRadius: 999,
            padding: "4px 10px",
            background: "rgba(2,6,23,0.7)",
            border: `1px solid ${tone.border}`,
            color: tone.badge,
          }}
        >
          {risk.riskLevel}
        </span>
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 800, color: "#E2E8F0" }}>
        {risk.riskScore}
      </p>

      <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#CBD5E1" }}>
        {risk.riskReasons.length === 0 ? (
          <li>No immediate risk triggers detected</li>
        ) : (
          risk.riskReasons.map((reason) => <li key={reason}>{reason}</li>)
        )}
      </ul>
    </section>
  );
}
