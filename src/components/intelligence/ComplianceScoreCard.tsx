"use client";

import Card from "@/components/ui/Card";

type ComplianceScoreCardProps = {
  role: string | null | undefined;
  visibleModuleCount: number;
};

export default function ComplianceScoreCard({
  role,
  visibleModuleCount,
}: ComplianceScoreCardProps) {
  const baseScore = role === "admin" ? 96 : 92;
  const documentCoverage = Math.min(99, 84 + visibleModuleCount * 4);
  const policyAlignment = Math.min(99, 86 + visibleModuleCount * 3);

  return (
    <Card className="intelligence-card">
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(110, 180, 255, 0.35)",
          background:
            "linear-gradient(160deg, rgba(10, 33, 64, 0.94), rgba(16, 29, 53, 0.92))",
          boxShadow:
            "0 16px 40px rgba(60, 145, 255, 0.24), inset 0 0 28px rgba(95, 180, 255, 0.08)",
          color: "#e7f0ff",
          padding: 14,
          fontFamily: "\"Segoe UI\", system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, opacity: 0.82 }}>
          Compliance Intelligence
        </p>
        <h3 style={{ margin: "8px 0 10px", fontSize: 28, color: "#ffffff" }}>
          {baseScore}%
        </h3>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(140, 199, 255, 0.25)",
              background: "linear-gradient(140deg, rgba(31, 57, 98, 0.6), rgba(21, 41, 74, 0.66))",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>Doc Coverage</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
              {documentCoverage}%
            </p>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(140, 199, 255, 0.25)",
              background: "linear-gradient(140deg, rgba(31, 57, 98, 0.6), rgba(21, 41, 74, 0.66))",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>
              Policy Alignment
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
              {policyAlignment}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
