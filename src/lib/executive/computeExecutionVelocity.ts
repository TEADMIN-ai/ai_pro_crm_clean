// src/lib/executive/computeExecutionVelocity.ts

import type { Deal } from "@/types/deal";

export function computeExecutionVelocity(deals: Deal[]): number {
  if (!deals.length) return 0;

  const submitted = deals.filter((d) => d.stage === "submitted").length;
  const total = deals.length;

  return submitted / total;
}

