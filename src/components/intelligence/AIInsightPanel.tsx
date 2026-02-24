"use client";

import Card from "@/components/ui/Card";

type AIInsightPanelProps = {
  role: string | null | undefined;
  visibleModuleCount: number;
};

export default function AIInsightPanel({
  role,
  visibleModuleCount,
}: AIInsightPanelProps) {
  const leadRisk = role === "admin" ? "Low" : "Moderate";
  const pipelineHealth = visibleModuleCount === 3 ? "Strong" : "Stable";
  const closeWindow = visibleModuleCount === 3 ? "7 days" : "9 days";

  const insights = [
    {
      label: "Pipeline Health",
      value: pipelineHealth,
      note: "Conversion velocity remains on target.",
    },
    {
      label: "Lead Risk",
      value: leadRisk,
      note: "AI flags no urgent account compliance risk.",
    },
    {
      label: "Best Close Window",
      value: closeWindow,
      note: "Highest probability close window from recent trends.",
    },
  ];

  return (
    <Card>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(109, 182, 255, 0.26)",
          background:
            "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))",
          boxShadow:
            "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)",
          padding: 14,
          fontFamily: "\"Segoe UI\", system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>
          AI Insight Readiness
        </p>
        <h3 style={{ margin: "8px 0 12px", color: "#ffffff" }}>
          Executive Signals
        </h3>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {insights.map((insight) => (
            <div
              key={insight.label}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(149, 203, 255, 0.25)",
                background: "linear-gradient(140deg, rgba(33, 58, 93, 0.62), rgba(21, 40, 69, 0.66))",
                padding: 12,
              }}
            >
              <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>
                {insight.label}
              </p>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "#f2f8ff",
                  fontWeight: 700,
                  fontSize: 20,
                }}
              >
                {insight.value}
              </p>
              <p style={{ margin: "8px 0 0", color: "#cae0ff", fontSize: 13 }}>
                {insight.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
