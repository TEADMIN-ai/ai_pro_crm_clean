// src/components/tender/TenderActions.tsx

"use client";

import type { Deal } from "@/types/deal";
import type { TenderReadiness } from "@/hooks/useTenderReadiness";

type Props = {
  deal: Deal;
  readiness: TenderReadiness;
};

export default function TenderActions({ deal, readiness }: Props) {
  function exportTenderPack() {
    const payload = {
      deal: {
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        value: deal.value,
        currency: deal.currency ?? "ZAR",
        clientName: deal.clientName ?? null,
      },
      readiness: {
        status: readiness.status,
        coveragePercent: readiness.coveragePercent,
        matchedCount: readiness.matchedCount,
        totalRequired: readiness.totalRequired,
      },
      documents: readiness.matches.map((m) => ({
        requirementId: m.requirement.id,
        requirementLabel: m.requirement.label,
        required: m.requirement.required,
        matchType: m.matchType,
        matchedDocument: m.matchedDoc
          ? {
              id: m.matchedDoc.id,
              name: m.matchedDoc.name,
            }
          : null,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tender-pack-${deal.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        marginTop: 24,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={exportTenderPack}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 10px 25px rgba(37,99,235,0.45)",
        }}
      >
        Export Tender Pack
      </button>
    </div>
  );
}