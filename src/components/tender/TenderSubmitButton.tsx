"use client";

import type { Deal } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";

type Props = {
  deal: Deal;
  disabled?: boolean;
  disabledReason?: string;
  onSubmitAction: (deal: Deal) => void;
};

export default function TenderSubmitButton({
  deal,
  disabled,
  disabledReason,
  onSubmitAction,
}: Props) {
  const locked = isTenderLocked(deal);
  const finalDisabled = Boolean(disabled || locked);

  const reason =
    locked ? "Tender already submitted (locked)" : disabledReason ?? "";

  return (
    <button
      type="button"
      disabled={finalDisabled}
      onClick={() => {
        if (finalDisabled) return;
        onSubmitAction(deal);
      }}
      title={finalDisabled ? reason : "Submit tender"}
      style={{
        padding: "10px 16px",
        borderRadius: 12,
        border: "none",
        fontWeight: 700,
        cursor: finalDisabled ? "not-allowed" : "pointer",
        opacity: finalDisabled ? 0.6 : 1,
        background: "#2563eb",
        color: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      }}
    >
      {locked ? "Tender Locked" : "Submit Tender"}
    </button>
  );
}

