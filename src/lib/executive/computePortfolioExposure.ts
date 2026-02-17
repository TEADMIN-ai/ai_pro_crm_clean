// src/lib/executive/computePortfolioExposure.ts

import type { Deal } from "@/types/deal";

export function computePortfolioExposure(deals: Deal[]): number {
  if (!deals.length) return 0;

  const highValueDeals = deals.filter((d) => (d.value ?? 0) > 200000).length;

  return Math.round((highValueDeals / deals.length) * 100);
}

