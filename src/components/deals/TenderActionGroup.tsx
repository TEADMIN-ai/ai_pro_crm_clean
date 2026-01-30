"use client";

import type { Deal } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";

type Props = {
  deal: Deal;
  onExportAction: () => void;
  onSubmitAction?: () => void;
  missingDocumentsCount?: number;
};

export default function TenderActionGroup({
  deal,
  onExportAction,
  onSubmitAction,
  missingDocumentsCount = 0,
}: Props) {
  const locked = isTenderLocked(deal);
  const canSubmit = !locked && missingDocumentsCount === 0;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Export button */}
      <button
        onClick={onExportAction}
        disabled={locked}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #2563eb",
          background: locked ? "#e5e7eb" : "#2563eb",
          color: locked ? "#6b7280" : "#ffffff",
          cursor: locked ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        📦 Export Tender
      </button>

      {/* Submit button (optional, future-safe) */}
      {onSubmitAction && (
        <button
          onClick={onSubmitAction}
          disabled={!canSubmit}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #16a34a",
            background: canSubmit ? "#16a34a" : "#e5e7eb",
            color: canSubmit ? "#ffffff" : "#6b7280",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          🚀 Submit Tender
        </button>
      )}
    </div>
  );
}