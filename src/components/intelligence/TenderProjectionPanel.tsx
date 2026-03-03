"use client";

import {
  projectTenderImprovement,
  type TenderCategoryScores,
} from "@/lib/intelligence/tenderImprovementEngine";

type TenderProjectionPanelProps = {
  categoryScores: TenderCategoryScores;
};

const severityTone: Record<string, { background: string; color: string; border: string }> = {
  low: {
    background: "rgba(0,255,157,0.12)",
    color: "#86efac",
    border: "rgba(0,255,157,0.35)",
  },
  medium: {
    background: "rgba(250,204,21,0.12)",
    color: "#fde047",
    border: "rgba(250,204,21,0.35)",
  },
  high: {
    background: "rgba(249,115,22,0.12)",
    color: "#fdba74",
    border: "rgba(249,115,22,0.35)",
  },
  critical: {
    background: "rgba(255,77,77,0.12)",
    color: "#fca5a5",
    border: "rgba(255,77,77,0.35)",
  },
};

export default function TenderProjectionPanel({
  categoryScores,
}: TenderProjectionPanelProps) {
  const projection = projectTenderImprovement(categoryScores);
  const tone = severityTone[projection.severityLevel] ?? severityTone.critical;

  return (
    <section
      style={{
        border: "1px solid #1E293B",
        borderRadius: 14,
        padding: 16,
        background: "#0F172A",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Tender Improvement Projection</h2>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 700,
          }}
        >
          {projection.severityLevel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Weakest Category</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>{projection.weakestCategory}</p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Projected Score</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>{projection.projectedScore}%</p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 12 }}>Improvement Delta</p>
          <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: "#00F0FF" }}>
            +{projection.improvementDelta}%
          </p>
        </div>
      </div>
    </section>
  );
}
