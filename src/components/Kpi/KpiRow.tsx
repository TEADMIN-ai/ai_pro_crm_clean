"use client";

import React from "react";

type Kpi = {
  label: string;
  value: number;
};

export default function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div style={gridStyle}>
      {kpis.map((kpi) => (
        <div key={kpi.label} style={cardStyle}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{kpi.label}</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ===== Styles ===== */

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 20,
  marginBottom: 32,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};