// src/app/dashboard/deals/DealsClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal, DealAuditActor, DealStage } from "@/types/deal";
import DealCard from "@/components/deals/DealCard";
import { updateDeal } from "@/lib/deals/updateDeal";
import { submitTender } from "@/lib/deals/submitTender";
import { approvePricingByManager } from "@/lib/firestore/deals";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import { useAuth } from "@/context/AuthContext";

export default function DealsClient() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const { user } = useAuth();

  const actor: DealAuditActor | undefined = useMemo(() => {
    if (!user) return undefined;

    return {
      uid: String((user as any).uid ?? ""),
      email: (user as any).email ?? null,
      name: (user as any).displayName ?? null,
    };
  }, [user]);

  // ✅ Load deals AFTER auth is ready (client-side only)
  useEffect(() => {
    if (!user) return;

    async function loadDeals() {
      try {
        const result = await getDealsForUser();
        setDeals(result);
      } catch (err) {
        console.error("Failed to load deals:", err);
      }
    }

    loadDeals();
  }, [user]);

  async function handleDealChange(updatedDeal: Deal) {
    setDeals((prev) =>
      prev.map((d) => (d.id === updatedDeal.id ? updatedDeal : d))
    );

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

  async function handleManagerApproval(deal: Deal) {
    if (!actor?.uid) {
      alert("User not authenticated");
      return;
    }

    try {
      await approvePricingByManager(deal.id, actor.uid);

      setDeals((prev) =>
        prev.map((d) =>
          d.id === deal.id
            ? {
                ...d,
                pricingStatus: "manager_approved",
              }
            : d
        )
      );

      alert("Pricing approved successfully.");
    } catch (error: any) {
      alert(error.message);
    }
  }

  return (
    <>
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          onChangeAction={handleDealChange}
          onSubmitAction={handleTenderSubmit}
          onManagerApproveAction={handleManagerApproval}
        />
      ))}
    </>
  );
}