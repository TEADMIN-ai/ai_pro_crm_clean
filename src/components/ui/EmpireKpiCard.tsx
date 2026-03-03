"use client";

import { empireColors } from "@/theme/empireTheme";

type EmpireKpiCardProps = {
  title: string;
  value: number | string;
};

export default function EmpireKpiCard({ title, value }: EmpireKpiCardProps) {
  return (
    <div
      style={{
        background: empireColors.card,
        border: `1px solid ${empireColors.border}`,
        borderLeft: `4px solid ${empireColors.primary}`,
        borderRadius: 14,
        padding: 18,
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
      }}
      className="empire-kpi-card"
    >
      <div style={{ fontSize: 12, color: empireColors.textSecondary, letterSpacing: 0.35 }}>
        {title}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: empireColors.textPrimary, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}
