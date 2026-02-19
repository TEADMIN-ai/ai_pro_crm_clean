"use client";

import type { Deal, DealStage } from "@/types/deal";
import { computeTenderReadiness } from "@/lib/tender/computeTenderReadiness";
import { useAuth } from "@/context/AuthContext";
import { canSubmitDeal } from "@/lib/auth/roleUtils";

type Props = {
  deal: Deal;
  onChangeAction?: (deal: Deal) => void;
  onSubmitAction?: (deal: Deal) => void;
  onManagerApproveAction?: (deal: Deal) => void;
};

export default function DealCard({
  deal,
  onChangeAction,
  onSubmitAction,
  onManagerApproveAction,
}: Props) {
  const { role } = useAuth();
  const readiness = computeTenderReadiness(deal);

  const canSubmit =
    canSubmitDeal(role) &&
    deal.stage === "manager_review" &&
    deal.pricingStatus === "manager_approved" &&
    !deal.isTenderLocked &&
    readiness.isReady;

  return (
    <div
      style={{
        padding: 20,
        marginBottom: 20,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h3>{deal.title}</h3>

      <p><strong>Stage:</strong> {deal.stage}</p>
      <p><strong>Pricing Status:</strong> {deal.pricingStatus}</p>
      <p><strong>Assigned To:</strong> {deal.assignedTo ?? "Unassigned"}</p>

      {deal.isTenderLocked && (
        <p style={{ color: "green" }}>
          ✔ Tender Locked (Submitted)
        </p>
      )}

      {/* Manager approval button */}
      {deal.pricingStatus !== "manager_approved" && onManagerApproveAction && (
        <button
          onClick={() => onManagerApproveAction(deal)}
          style={{ marginRight: 10 }}
        >
          Approve Pricing
        </button>
      )}

      {/* Submit Tender Button */}
      {onSubmitAction && (
        <button
          disabled={!canSubmit}
          onClick={() => canSubmit && onSubmitAction(deal)}
        >
          Submit Tender
        </button>
      )}

      {!readiness.isReady && (
        <div style={{ marginTop: 10, color: "orange" }}>
          Missing: {readiness.missingFields.join(", ")}
        </div>
      )}
    </div>
  );
}

