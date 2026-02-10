"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal, DealAuditActor, DealStage } from "@/types/deal";
import DealCard from "@/components/deals/DealCard";
import { updateDealStage } from "@/lib/deals/updateDealStage";
import { submitTender } from "@/lib/deals/submitTender";
import { approvePricingByManager } from "@/lib/firestore/deals";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import { useAuth } from "@/context/AuthContext";

export default function DealsClient() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const { user } = useAuth();

  const actor: DealAuditActor | undefined = useMemo(() => {
    if (!user?.uid) return undefined;

    return {
      uid: user.uid,
      email: user.email ?? null,
      name: (user as any).displayName ?? null,
    };
  }, [user]);

  useEffect(() => {
    async function loadDeals() {
      try {
        const result = await getDealsForUser();
        setDeals(result);
      } catch (err) {
        console.error("Failed to load deals:", err);
      }
    }

    loadDeals();
  }, []);

  async function handleDealChange(updatedDeal: Deal) {
    setDeals((prev) =>
      prev.map((d) => (d.id === updatedDeal.id ? updatedDeal : d))
    );

    await updateDealStage(updatedDeal.id, updatedDeal.stage);
  }

  async function handleTenderSubmit(deal: Deal) {
    if (!actor) return;

    await submitTender(deal, actor);

    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? {
              ...d,
              stage: "submitted" as DealStage,
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
            ? { ...d, pricingStatus: "manager_approved" }
            : d
        )
      );
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