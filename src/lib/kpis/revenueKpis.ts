// src/lib/kpis/revenueKpis.ts

import type { Deal } from "@/types/deal";

/**
 * Canonical revenue KPI shape
 * This file is the single source of truth for revenue metrics
 */

export type RevenueKpis = {
  totalRevenue: number;
  wonDeals: number;
  averageDealSize: number;
};

/**
 * Compute revenue KPIs from deals
 * SAFE: no UI, no React, pure calculation
 */
export function computeRevenueKpis(deals: Deal[]): RevenueKpis {
  const wonDeals = deals.filter((d) => d.stage === "won");

  const totalRevenue = wonDeals.reduce(
    (sum, deal) => sum + (deal.value ?? 0),
    0
  );

  const averageDealSize =
    wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;

  return {
    totalRevenue,
    wonDeals: wonDeals.length,
    averageDealSize,
  };
}