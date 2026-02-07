// src/components/deals/DealCard.tsx

"use client";

import type { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
  onChangeAction: (deal: Deal) => void;
  onSubmitAction: (deal: Deal) => void;
  onManagerApproveAction?: (deal: Deal) => void; // ✅ NEW PROP
};

export default function DealCard({
  deal,
  onChangeAction,
  onSubmitAction,
  onManagerApproveAction,
}: Props) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <h3>{deal.title}</h3>

      <p>
        <strong>Stage:</strong> {deal.stage}
      </p>

      <p>
        <strong>Pricing Status:</strong> {deal.pricingStatus ?? "not_started"}
      </p>
      <p style={{ color: "red" }}>
  Debug ID: {deal.id}
</p>

<p style={{ color: "orange" }}>
  Debug Pricing: {deal.pricingStatus ?? "undefined"}
</p>
      {/* 🔹 Manager Approval Button */}
      {deal.pricingStatus === "ai_generated" &&
        onManagerApproveAction && (
          <button
            onClick={() => onManagerApproveAction(deal)}
            style={{
              backgroundColor: "#1e293b",
              color: "white",
              padding: "6px 10px",
              borderRadius: "4px",
              marginTop: "8px",
              marginRight: "8px",
            }}
          >
            Approve Pricing
          </button>
        )}

      {/* 🔹 Submit Tender Button */}
      {!deal.isTenderLocked && (
        <button
          onClick={() => onSubmitAction(deal)}
          style={{
            backgroundColor: "#0f766e",
            color: "white",
            padding: "6px 10px",
            borderRadius: "4px",
            marginTop: "8px",
          }}
        >
          Submit Tender
        </button>
      )}
    </div>
  );
}