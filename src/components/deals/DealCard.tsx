"use client";

import type { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
};

export default function DealCard({ deal }: Props) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
        marginBottom: 12,
      }}
    >
      <strong>{deal.title}</strong>

      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          opacity: 0.85,
        }}
      >
        Stage: {deal.stage ?? "lead"} • Value: ZAR{" "}
        {(deal.value ?? 0).toLocaleString("en-ZA")}
      </div>
    </div>
  );
}