// src/lib/executive/computePipelineQuality.ts

import type { Deal } from "@/types/deal";

export function computePipelineQuality(deals: Deal[]): { score: number } {
  if (!deals.length) return { score: 0 };

  const approved = deals.filter(
    (d) => d.pricingStatus === "manager_approved"
  ).length;

  const ratio = approved / deals.length;

  return {
    score: Math.round(ratio * 100),
  };
}

