// src/components/tender/TenderReadinessPanel.tsx

"use client";

import type {
  TenderReadiness,
  RequirementMatch,
} from "@/hooks/useTenderReadiness";

type Props = {
  readiness: TenderReadiness;
};

export default function TenderReadinessPanel({ readiness }: Props) {
  const { totalRequired, matchedCount, coveragePercent, status, matches } =
    readiness;

  const statusColor =
    status === "ready"
      ? "#16a34a"
      : status === "partial"
      ? "#f59e0b"
      : "#dc2626";

  return (
    <div
      style={{
        marginTop: 28,
        padding: 22,
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 18, marginBottom: 6 }}>
          Tender Readiness
        </h3>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {matchedCount} of {totalRequired} required documents matched
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.15)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${coveragePercent}%`,
            height: "100%",
            background: statusColor,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {/* STATUS */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: statusColor,
          marginBottom: 20,
        }}
      >
        Status: {status.toUpperCase()} ({coveragePercent}%)
      </div>

      {/* REQUIREMENT LIST */}
      <div style={{ display: "grid", gap: 10 }}>
        {matches.map((m) => (
          <RequirementRow key={m.requirement.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function RequirementRow({ match }: { match: RequirementMatch }) {
  const { requirement, matchedDoc, matchType } = match;

  const icon =
    matchType === "id"
      ? "✔️"
      : matchType === "name"
      ? "🟡"
      : "❌";

  const color =
    matchType === "id"
      ? "#22c55e"
      : matchType === "name"
      ? "#facc15"
      : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {requirement.label}
          {requirement.required && (
            <span style={{ color: "#f87171", marginLeft: 6 }}>*</span>
          )}
        </div>

        {matchedDoc && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Matched: {matchedDoc.name}
          </div>
        )}
      </div>

      <div style={{ fontSize: 16, color }}>{icon}</div>
    </div>
  );
}