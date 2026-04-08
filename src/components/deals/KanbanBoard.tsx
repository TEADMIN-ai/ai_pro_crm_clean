"use client";

import type { Deal, DealStage } from "@/types/deal";

const dealStages: DealStage[] = [
  "draft",
  "lead",
  "in_review",
  "pricing",
  "manager_review",
  "submitted",
  "awarded",
  "won",
  "rejected",
  "lost",
  "closed",
];

type Props = {
  deals: Deal[];
};

export default function KanbanBoard({ deals }: Props) {
  return (
    <div style={{ display: "flex", gap: 20 }}>
      {dealStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);

        return (
          <div
            key={stage}
            style={{
              flex: 1,
              background: "#f4f6f9",
              padding: 10,
              borderRadius: 8,
            }}
          >
            <h3 style={{ textTransform: "capitalize" }}>{stage}</h3>

            {stageDeals.map((deal) => (
              <div
                key={deal.id}
                style={{
                  background: "white",
                  padding: 10,
                  marginBottom: 10,
                  borderRadius: 6,
                }}
              >
                <strong>{deal.title}</strong>
                <div>Value: {deal.value ?? 0}</div>
              </div>
            ))}

            {stageDeals.length === 0 && (
              <div style={{ opacity: 0.5 }}>No deals</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

