"use client";

import type { TenderTrajectoryResult } from "@/lib/intelligence/tenderTrajectory";

type TrajectoryPoint = {
  probability: number;
  timestamp?: number;
};

type TenderTrajectoryPanelProps = {
  trajectory: TenderTrajectoryResult;
  points: TrajectoryPoint[];
};

const toneMap = {
  up: {
    color: "#22c55e",
    glowClass: "trajectory-up-pulse",
    arrow: "↑",
    badgeBg: "rgba(34,197,94,0.16)",
    badgeBorder: "rgba(34,197,94,0.4)",
  },
  down: {
    color: "#ef4444",
    glowClass: "trajectory-down-pulse",
    arrow: "↓",
    badgeBg: "rgba(239,68,68,0.16)",
    badgeBorder: "rgba(239,68,68,0.4)",
  },
  flat: {
    color: "#00F0FF",
    glowClass: "",
    arrow: "→",
    badgeBg: "rgba(0,240,255,0.14)",
    badgeBorder: "rgba(0,240,255,0.36)",
  },
} as const;

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function TenderTrajectoryPanel({
  trajectory,
  points,
}: TenderTrajectoryPanelProps) {
  const tone = toneMap[trajectory.direction];
  const values = points.map((point) => point.probability);
  const sparklinePath = buildSparklinePath(values, 320, 70);
  const changePrefix = trajectory.delta > 0 ? "+" : "";

  return (
    <section
      className={tone.glowClass}
      style={{
        border: `1px solid ${tone.badgeBorder}`,
        borderRadius: 14,
        padding: 16,
        background: "#0F172A",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Tender Trajectory</h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            padding: "4px 10px",
            border: `1px solid ${tone.badgeBorder}`,
            background: tone.badgeBg,
            color: tone.color,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          <span>{tone.arrow}</span>
          <span>{trajectory.momentumLabel}</span>
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <svg width="100%" height="80" viewBox="0 0 320 80" role="img" aria-label="WPI sparkline">
          <path d={sparklinePath} fill="none" stroke={tone.color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <p style={{ margin: "6px 0 0", color: "#CBD5E1" }}>
        Change since last save:{" "}
        <strong style={{ color: tone.color }}>
          {changePrefix}
          {trajectory.delta}%
        </strong>
      </p>
    </section>
  );
}
