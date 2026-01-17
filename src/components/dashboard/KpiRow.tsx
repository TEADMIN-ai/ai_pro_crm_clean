"use client";

import React from "react";

type Kpi = {
  label: string;
  value: number;
  accent: string;
};

export default function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div style={styles.row}>
      {items.map((kpi) => (
        <div key={kpi.label} style={{ ...styles.card, borderColor: kpi.accent }}>
          <div style={styles.value}>{kpi.value}</div>
          <div style={styles.label}>{kpi.label}</div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 24,
    marginBottom: 32,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
  },
  value: {
    fontSize: 32,
    fontWeight: 700,
    color: "#fff",
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#9ca3af",
  },
};