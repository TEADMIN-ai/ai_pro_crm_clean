"use client";

import { useState } from "react";
import { submitTenderDeal } from "@/lib/tender/submitTender";
import { useAuth } from "@/context/AuthContext";
import type { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
};

export default function TenderSubmitButton({ deal }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 🔒 Guard: already submitted / locked
  if ((deal as any).tenderSubmitted || (deal as any).tenderLocked) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(34,197,94,0.12)",
          color: "#22c55e",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Tender submitted & locked
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitTenderDeal({
        dealId: deal.id,
        userId: user.uid,
        deal,
      });

      setDone(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit tender");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={handleSubmit}
        disabled={submitting || done}
        style={{
          padding: "12px 18px",
          borderRadius: 12,
          border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          background: done
            ? "#16a34a"
            : "linear-gradient(135deg,#f97316,#ea580c)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting
          ? "Submitting tender…"
          : done
          ? "Tender submitted"
          : "Submit Tender"}
      </button>

      {error && (
        <div style={{ marginTop: 8, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}