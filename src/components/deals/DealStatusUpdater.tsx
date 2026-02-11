"use client";

import type { Deal, DealStage } from "@/types/deal";

type Props = {
  deal: Deal;
  onStageChangeAction: (dealId: string, stage: DealStage) => void;
};

const STAGES: DealStage[] = [
  "draft",
  "pricing",
  "manager_review",
  "submitted",
  "won",
  "lost",
];

export default function DealStatusUpdater({
  deal,
  onStageChangeAction,
}: Props) {
  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = event.target.value as DealStage;
    onStageChangeAction(deal.id, newStage);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginRight: 8,
        }}
      >
        Update Stage:
      </label>

      <select
        value={deal.stage}
        onChange={handleChange}
        style={{
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid #ccc",
        }}
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
    </div>
  );
}