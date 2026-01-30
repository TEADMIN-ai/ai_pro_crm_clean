"use client";

import { isTenderLocked } from "@/lib/tender/isTenderLocked";
import type { Deal, DealStage } from "@/types/deal";

type Props = {
  deal: Deal;
  onChangeAction?: (stage: DealStage) => void;
};

const STAGES: DealStage[] = [
  "lead",
  "tender",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export default function DealStatusUpdater({
  deal,
  onChangeAction,
}: Props) {
  const locked = isTenderLocked(deal);

  if (locked) {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(239,68,68,0.12)",
          color: "#ef4444",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Tender locked — status immutable
      </div>
    );
  }

  return (
    <select
      value={deal.stage}
      onChange={(e) =>
        onChangeAction?.(e.target.value as DealStage)
      }
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.1)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}