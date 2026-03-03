"use client";

import React from "react";
import EmpireKpiCard from "@/components/ui/EmpireKpiCard";

type KPI = {
  label: string;
  value: number;
};

export default function KpiRow({ kpis }: { kpis: KPI[] }) {
  return (
    <div style={gridStyle}>
      {kpis.map((kpi) => (
        <EmpireKpiCard key={kpi.label} title={kpi.label} value={kpi.value} />
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

