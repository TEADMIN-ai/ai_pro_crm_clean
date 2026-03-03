"use client";

type ImpactAttributionPanelProps = {
  deltaProbability: number;
  explanationLines: string[];
};

function resolveTone(deltaProbability: number) {
  if (deltaProbability > 0) {
    return {
      border: "rgba(34,197,94,0.45)",
      glow: "0 0 14px rgba(34,197,94,0.4)",
      valueColor: "#22c55e",
    };
  }
  if (deltaProbability < 0) {
    return {
      border: "rgba(239,68,68,0.45)",
      glow: "0 0 14px rgba(239,68,68,0.35)",
      valueColor: "#ef4444",
    };
  }
  return {
    border: "rgba(0,240,255,0.38)",
    glow: "none",
    valueColor: "#00F0FF",
  };
}

export default function ImpactAttributionPanel({
  deltaProbability,
  explanationLines,
}: ImpactAttributionPanelProps) {
  const tone = resolveTone(deltaProbability);
  const prefix = deltaProbability > 0 ? "+" : "";

  return (
    <section
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 14,
        padding: 16,
        background: "#0F172A",
        boxShadow: tone.glow,
        marginBottom: 20,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Impact Attribution</h2>
      <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 800, color: tone.valueColor }}>
        {prefix}
        {deltaProbability}%
      </p>

      <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#CBD5E1" }}>
        {explanationLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
