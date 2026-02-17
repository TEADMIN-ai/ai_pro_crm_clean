// src/lib/executive/computeRevenueMomentum.ts

import type { Deal } from "@/types/deal";

export function computeRevenueMomentum(
  deals: Deal[]
): { percentage: number; trend: "up" | "down" | "flat" } {
  if (!deals.length) {
    return { percentage: 0, trend: "flat" };
  }

  const won = deals.filter((d) => d.stage === "won").length;
  const submitted = deals.filter((d) => d.stage === "submitted").length;

  if (submitted === 0) {
    return { percentage: 0, trend: "flat" };
  }

  const percentage = (won / submitted) * 100;

  let trend: "up" | "down" | "flat" = "flat";

  if (percentage >= 60) trend = "up";
  else if (percentage < 40) trend = "down";

  return {
    percentage,
    trend,
  };
}

