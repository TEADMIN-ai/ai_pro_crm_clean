"use client";

import type { Deal } from "@/types/deal";

type Props = {
  deal: Partial<Deal>;
};

export default function DealCard({ deal }: Props) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <strong style={{ fontSize: 15 }}>
        {deal.title ?? "Untitled Deal"}
      </strong>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Client: {deal.clientName ?? "—"}
      </div>

      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Stage: {deal.stage ?? "unknown"}
      </div>

      {typeof deal.value === "number" && (
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {(deal.currency ?? "ZAR") + " "}
          {deal.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}
