"use client";

import React from "react";

type KPI = {
  label: string;
  value: number;
};

export default function KpiRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div style={gridStyle}>
      {kpis.map((kpi) => (
        <div key={kpi.label} style={cardStyle}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>{kpi.label}</div>
          <div style={{ fontSize: 32, fontWeight: 600 }}>{kpi.value}</div>
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
  marginBottom: 40,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};