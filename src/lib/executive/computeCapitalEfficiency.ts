// src/lib/executive/computeCapitalEfficiency.ts

import type { Deal } from "@/types/deal";

export function computeCapitalEfficiency(deals: Deal[]): number {
  if (!deals.length) return 0;

  const invested = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const wonRevenue = deals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

  if (invested === 0) return 0;

  return wonRevenue / invested;
}

