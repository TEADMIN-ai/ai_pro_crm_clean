"use client";

import type { Deal, DealStage } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";

type Props = {
  deal: Deal;
  onChangeAction: (stage: DealStage) => void;
};

export default function DealStatusUpdater({
  deal,
  onChangeAction,
}: Props) {
  const locked = isTenderLocked(deal);

  return (
    <select
      value={deal.stage}
      disabled={locked}
      onChange={(e) =>
        onChangeAction(e.target.value as DealStage)
      }
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        opacity: locked ? 0.5 : 1,
        cursor: locked ? "not-allowed" : "pointer",
      }}
    >
      <option value="lead">Lead</option>
      <option value="tender">Tender</option>
      <option value="proposal">Proposal</option>
      <option value="negotiation">Negotiation</option>
      <option value="won">Won</option>
      <option value="lost">Lost</option>
    </select>
  );
}