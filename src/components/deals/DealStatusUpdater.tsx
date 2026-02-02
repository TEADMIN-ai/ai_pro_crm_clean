"use client";

import type { Deal, DealStage } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";

type Props = {
  deal: Deal;
  onChangeAction: (updatedDeal: Deal) => void;
};

const STAGES: DealStage[] = [
  "lead",
  "tender",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "submitted",
];

export default function DealStatusUpdater({ deal, onChangeAction }: Props) {
  const locked = isTenderLocked(deal);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStage = e.target.value as DealStage;

    // If locked, ignore changes
    if (locked) return;

    onChangeAction({ ...deal, stage: nextStage });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <select
        value={deal.stage}
        onChange={onChange}
        disabled={locked}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.18)",
          opacity: locked ? 0.6 : 1,
          cursor: locked ? "not-allowed" : "pointer",
        }}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {locked && (
        <span
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.10)",
          }}
        >
          🔒 Locked
        </span>
      )}
    </div>
  );
}