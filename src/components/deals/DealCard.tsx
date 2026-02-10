"use client";

import { useState } from "react";
import type { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
  onChangeAction: (deal: Deal) => void;
  onSubmitAction: (deal: Deal) => Promise<void>;
  onManagerApproveAction?: (deal: Deal) => void;
};

export default function DealCard({
  deal,
  onChangeAction,
  onSubmitAction,
  onManagerApproveAction,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const isReadyForSubmit =
    deal.pricingStatus === "manager_approved" &&
    deal.stage === "manager_review" &&
    !!deal.assignedTo &&
    !deal.isTenderLocked;

  async function handleSubmit() {
    if (!isReadyForSubmit) return;

    try {
      setSubmitting(true);
      await onSubmitAction(deal);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        background: "#ffffff",
      }}
    >
      <h3>{deal.title}</h3>

      <p>
        <strong>Stage:</strong> {deal.stage}
      </p>

      <p>
        <strong>Pricing Status:</strong>{" "}
        {deal.pricingStatus ?? "not_started"}
      </p>

      <p>
        <strong>Assigned To:</strong>{" "}
        {deal.assignedTo ?? "Unassigned"}
      </p>

      {/* Manager Approval Button */}
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

      {/* Submit Tender Button */}
      {isReadyForSubmit && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? "#94a3b8" : "#0f766e",
            color: "white",
            padding: "6px 10px",
            borderRadius: "4px",
            marginTop: "8px",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : "Submit Tender"}
        </button>
      )}

      {deal.isTenderLocked && (
        <p style={{ color: "green", marginTop: 8 }}>
          ✔ Tender Locked (Submitted)
        </p>
      )}
    </div>
  );
}