import { Deal, DealStage } from "@/types/deal";

/**
 * Safely normalise deal stage
 * Prevents crashes from undefined / legacy values
 */
export function getSafeStage(stage?: string): DealStage {
  const validStages: DealStage[] = [
    "lead",
    "tender",
    "proposal",
    "negotiation",
    "won",
    "lost",
    "closed",
  ];

  return validStages.includes(stage as DealStage)
    ? (stage as DealStage)
    : "lead";
}

/**
 * Filter active (non-archived, non-closed) deals
 */
export function getActiveDeals(deals: Deal[]): Deal[] {
  return deals.filter(
    (deal) =>
      !deal.isArchived &&
      getSafeStage(deal.stage) !== "closed"
  );
}

/**
 * Count deals by stage
 */
export function countByStage(
  deals: Deal[],
  stage: DealStage
): number {
  return deals.filter(
    (deal) =>
      getSafeStage(deal.stage) === stage &&
      !deal.isArchived
  ).length;
}

/**
 * Calculate average deal value
 */
export function calculateAverageDealValue(
  deals: Deal[]
): number {
  const validDeals = deals.filter(
    (deal) =>
      typeof deal.value === "number" &&
      deal.value > 0 &&
      !deal.isArchived
  );

  if (validDeals.length === 0) return 0;

  const total = validDeals.reduce(
    (sum, deal) => sum + (deal.value ?? 0),
    0
  );

  return Math.round(total / validDeals.length);
}

/**
 * Manager KPIs (global)
 */
export function calculateManagerKpis(deals: Deal[]) {
  const activeDeals = getActiveDeals(deals);

  return {
    totalDeals: activeDeals.length,
    newDeals: countByStage(activeDeals, "lead"),
    negotiationDeals: countByStage(activeDeals, "negotiation"),
    wonDeals: countByStage(deals, "won"),
    lostDeals: countByStage(deals, "lost"),
    avgDealValue: calculateAverageDealValue(activeDeals),
    unassignedDeals: activeDeals.filter(
      (d) => !d.ownerId
    ).length,
  };
}

/**
 * Staff KPIs (per user)
 */
export function calculateStaffKpis(
  deals: Deal[],
  userId: string
) {
  const myDeals = deals.filter(
    (deal) =>
      deal.ownerId === userId &&
      !deal.isArchived
  );

  return {
    myDeals: myDeals.length,
    myOpenDeals: myDeals.filter(
      (d) =>
        !["won", "lost", "closed"].includes(
          getSafeStage(d.stage)
        )
    ).length,
    myWonDeals: countByStage(myDeals, "won"),
    myLostDeals: countByStage(myDeals, "lost"),
  };
}