"use client";

import type { RevenueIntelligence } from "@/lib/kpis/revenueIntelligence";

type Props = {
  intelligence: RevenueIntelligence;
};

function moneyZAR(value: number) {
  return `ZAR ${Math.round(value).toLocaleString("en-ZA")}`;
}

export default function RevenueIntelligencePanel({ intelligence }: Props) {
  const {
    winRate,
    avgDealValue,
    stageBreakdown,
  } = intelligence;

  return (
    <div
      style={{
        marginTop: 28,
        padding: 22,
        borderRadius: 18,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 20px 48px rgba(0,0,0,0.25)",
      }}
    >
      <h3 style={{ marginBottom: 14 }}>Revenue Intelligence</h3>

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} />
        <Stat label="Avg Deal Value" value={moneyZAR(avgDealValue)} />
      </div>

      {/* STAGE BREAKDOWN */}
      <div>
        <strong style={{ opacity: 0.85 }}>Stage Breakdown</strong>

        <div style={{ marginTop: 12 }}>
          {Object.entries(stageBreakdown).map(([stage, stats]) => (
            <div
              key={stage}
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(0,0,0,0.18)",
                marginBottom: 10,
              }}
            >
              <strong style={{ textTransform: "capitalize" }}>
                {stage}
              </strong>

              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                Deals: {stats.count} • Value: {moneyZAR(stats.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}