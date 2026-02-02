"use client";

import type { Deal } from "@/types/deal";
import { computeTenderReadiness } from "@/lib/tender/computeTenderReadiness";

type Props = {
  deal: Deal;
  onSubmitAction: (deal: Deal) => void;
};

export default function TenderActions({ deal, onSubmitAction }: Props) {
  const readiness = computeTenderReadiness(deal); // ✅ ONE ARG ONLY

  if (!readiness.isReady) {
    return (
      <div className="mt-3">
        <button
          disabled
          className="rounded-lg bg-gray-300 px-4 py-2 text-gray-600 cursor-not-allowed"
          title="Complete all requirements before submitting"
        >
          Submit Tender ({readiness.completionPercent}%)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => onSubmitAction(deal)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Submit Tender
      </button>
    </div>
  );
}