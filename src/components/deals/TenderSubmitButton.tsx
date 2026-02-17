"use client";

import { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
  disabled?: boolean;
  onSubmitAction: (deal: Deal) => void;
};

export default function TenderSubmitButton({
  deal,
  disabled = false,
  onSubmitAction,
}: Props) {
  return (
    <button
      disabled={disabled}
      onClick={() => onSubmitAction(deal)}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        background: disabled ? "#999" : "#2563eb",
        color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      Submit Tender
    </button>
  );
}

