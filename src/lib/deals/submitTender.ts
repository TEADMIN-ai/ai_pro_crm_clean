// src/lib/deals/submitTender.ts

import type { Deal, DealAuditActor } from "@/types/deal";
import { computeTenderReadiness } from "@/lib/tender/computeTenderReadiness";
import { updateDeal } from "@/lib/deals/updateDeal";

export async function submitTender(deal: Deal, actor?: DealAuditActor): Promise<void> {
  const readiness = computeTenderReadiness(deal);

if (!readiness.isReady) {
  console.log("READINESS DEBUG:", readiness);
  throw new Error("Tender is not ready for submission.");
}

  await updateDeal(
    deal.id,
    {
      stage: "submitted",
      isTenderLocked: true,
      tenderSubmittedAt: new Date(),
      tenderSubmittedBy: actor,
    },
    deal,
    {
      actor,
      auditType: "tender_submitted",
      auditMeta: {
        completionPercent: readiness.completionPercent,
        missingDocuments: readiness.missingDocuments,
        missingFields: readiness.missingFields,
      },
    }
  );

  console.log("✅ Tender submitted + locked:", deal.id);
}

