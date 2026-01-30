// src/hooks/useTenderExports.ts
"use client";

import { buildTenderZip } from "@/lib/tender/tenderZipBuilder";
import type { Deal } from "@/types/deal";
import type { TenderExportModel } from "@/lib/tender/tenderExportModel";

export function useTenderExport() {
  async function exportTender(deal: Deal) {
    try {
      const model: TenderExportModel = {
        tenderId: deal.id,
        tenderTitle: deal.title || "tender",
        metadata: {
          dealId: deal.id,
          stage: deal.stage,
          value: deal.value,
          currency: deal.currency ?? "ZAR",
        },
        documents: [], // 🔒 SAFE: no file content yet (Phase E5)
      };

      const zipBlob = await buildTenderZip(model);

      // Trigger browser download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${model.tenderTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Tender export failed", err);
      alert("Tender export failed. Check console.");
    }
  }

  return { exportTender };
}