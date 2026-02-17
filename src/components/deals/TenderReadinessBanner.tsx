"use client";

import type { Deal } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";

type Props = {
  deal: Deal;
  missingDocumentsCount?: number;
};

export default function TenderReadinessBanner({
  deal,
  missingDocumentsCount = 0,
}: Props) {
  const locked = isTenderLocked(deal);
  const ready = !locked && missingDocumentsCount === 0;

  let background = "#fef3c7"; // amber
  let border = "#f59e0b";
  let text = "Tender in preparation";

  if (locked) {
    background = "#e5e7eb"; // gray
    border = "#9ca3af";
    text = "🔒 Tender submitted — deal locked";
  } else if (ready) {
    background = "#dcfce7"; // green
    border = "#22c55e";
    text = "✅ Tender ready for submission";
  } else if (missingDocumentsCount > 0) {
    background = "#fee2e2"; // red
    border = "#ef4444";
    text = `⚠️ ${missingDocumentsCount} required document(s) missing`;
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        borderRadius: 10,
        background,
        border: `1px solid ${border}`,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {text}
    </div>
  );
}

