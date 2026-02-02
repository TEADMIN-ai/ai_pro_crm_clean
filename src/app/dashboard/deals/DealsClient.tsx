// src/app/dashboard/deals/DealsClient.tsx
"use client";

import { useMemo, useState } from "react";
import type { Deal, DealAuditActor, DealStage } from "@/types/deal";
import DealCard from "@/components/deals/DealCard";
import { updateDeal } from "@/lib/deals/updateDeal";
import { submitTender } from "@/lib/deals/submitTender";
import { useAuth } from "@/context/AuthContext";

type Props = {
  initialDeals: Deal[];
};

export default function DealsClient({ initialDeals }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals ?? []);
  const { user } = useAuth();

  const actor: DealAuditActor | undefined = useMemo(() => {
    if (!user) return undefined;
    return {
      uid: String((user as any).uid ?? ""),
      email: (user as any).email ?? null,
      name: (user as any).displayName ?? null,
    };
  }, [user]);

  async function handleDealChange(updatedDeal: Deal) {
    // Update UI optimistically
    setDeals((prev) => prev.map((d) => (d.id === updatedDeal.id ? updatedDeal : d)));

    // Persist only the fields that changed (safe)
    await updateDeal(
      updatedDeal.id,
      { stage: updatedDeal.stage },
      updatedDeal,
      {
        actor,
        auditType: "stage_changed",
        auditMeta: { stage: updatedDeal.stage },
      }
    );
  }

  async function handleTenderSubmit(deal: Deal) {
    await submitTender(deal, actor);

    // Locally reflect lock + stage change
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? {
              ...d,
              stage: "submitted" as DealStage,
              isTenderLocked: true,
              tenderSubmittedAt: new Date(),
              tenderSubmittedBy: actor,
            }
          : d
      )
    );
  }

  return (
    <>
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          onChangeAction={handleDealChange}
          onSubmitAction={handleTenderSubmit}
        />
      ))}
    </>
  );
}