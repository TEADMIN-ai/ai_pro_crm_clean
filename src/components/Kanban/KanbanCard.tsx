"use client";

import type { Deal } from "@/types/deal";

export default function KanbanCard({ deal }: { deal: Deal }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <strong>{deal.title}</strong>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Stage: {deal.stage}
      </div>
    </div>
  );
}
