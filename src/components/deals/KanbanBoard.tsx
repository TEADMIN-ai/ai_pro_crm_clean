"use client";

import type { Deal, DealStage } from "@/types/deal";
import DealCard from "./DealCard";

const STAGES: DealStage[] = [
  "lead",
  "tender",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export default function KanbanBoard({ deals }: { deals: Deal[] }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
      {STAGES.map((stage) => (
        <div key={stage} style={{ minWidth: 280 }}>
          <h4 style={{ marginBottom: 12 }}>{stage.toUpperCase()}</h4>

          {deals
            .filter((d) => d.stage === stage)
            .map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
        </div>
      ))}
    </div>
  );
}