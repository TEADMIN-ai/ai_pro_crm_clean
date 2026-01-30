"use client";

import type { Deal } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";
import TenderSubmitButton from "./TenderSubmitButton";
import DealStatusUpdater from "./DealStatusUpdater";

type Props = {
  deal: Deal;
};

export default function DealCard({ deal }: Props) {
  const locked = isTenderLocked(deal);

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: locked
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.08)",
        border: locked
          ? "1px solid rgba(239,68,68,0.35)"
          : "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        opacity: locked ? 0.85 : 1,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <strong>{deal.title}</strong>
      </div>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Client: {deal.clientName ?? "—"}
      </div>

      <div style={{ marginTop: 8 }}>
        <DealStatusUpdater deal={deal} />
      </div>

      {!locked && (
        <TenderSubmitButton deal={deal} />
      )}

      {locked && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#ef4444",
            fontWeight: 600,
          }}
        >
          🔒 Deal locked — tender submitted
        </div>
      )}
    </div>
  );
}