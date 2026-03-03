"use client";

import type { WinProbabilityResult } from "@/lib/intelligence/winProbabilityIndex";

type WinProbabilityPanelProps = {
  result: WinProbabilityResult;
};

const glowMap: Record<
  WinProbabilityResult["classification"],
  { color: string; glow: string; track: string }
> = {
  "Low Chance": {
    color: "#ef4444",
    glow: "0 0 16px rgba(239,68,68,0.45)",
    track: "rgba(127, 29, 29, 0.35)",
  },
  Competitive: {
    color: "#f59e0b",
    glow: "0 0 16px rgba(245,158,11,0.45)",
    track: "rgba(120, 53, 15, 0.35)",
  },
  "Strong Position": {
    color: "#00F0FF",
    glow: "0 0 16px rgba(0,240,255,0.45)",
    track: "rgba(12, 74, 110, 0.35)",
  },
  "Highly Favorable": {
    color: "#22c55e",
    glow: "0 0 16px rgba(34,197,94,0.45)",
    track: "rgba(20, 83, 45, 0.35)",
  },
};

export default function WinProbabilityPanel({ result }: WinProbabilityPanelProps) {
  const tone = glowMap[result.classification];
  const clampedValue = Math.max(0, Math.min(100, result.probability));
  const progress = `${clampedValue}%`;

  return (
    <section
      style={{
        border: "1px solid rgba(30,41,59,0.95)",
        borderRadius: 14,
        padding: 18,
        background: "#0F172A",
        marginBottom: 20,
        boxShadow: tone.glow,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: "50%",
            background: `conic-gradient(${tone.color} ${progress}, ${tone.track} ${progress})`,
            display: "grid",
            placeItems: "center",
            boxShadow: tone.glow,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#020617",
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(30,41,59,0.9)",
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 800, color: "#E2E8F0" }}>
              {result.probability}%
            </span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Win Probability Index</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: tone.color }}>
            {result.classification}
          </p>
          <p style={{ margin: "10px 0 0", color: "#CBD5E1", lineHeight: 1.4 }}>
            {result.insight}
          </p>
        </div>
      </div>
    </section>
  );
}
