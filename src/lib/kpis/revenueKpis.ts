import type { Deal } from "@/types/deal";

export type RevenueKpis = {
  totalRevenue: number;
  wonDeals: number;
  avgDealSize: number;
};

export function computeRevenueKpis(deals: Deal[]): RevenueKpis {
  const wonDealsList = deals.filter(d => d.stage === "won");

  const totalRevenue = wonDealsList.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  );

  const avgDealSize =
    wonDealsList.length > 0
      ? totalRevenue / wonDealsList.length
      : 0;

  return {
    totalRevenue,
    wonDeals: wonDealsList.length,
    avgDealSize,
  };
}