"use client";

import { useMemo } from "react";
import type { Deal } from "@/types/deal";
import { computeRevenueKpis } from "@/lib/kpis/revenueKpis";

/**
 * Hook wrapper for revenue KPIs
 */
export function useRevenueKpis(deals: Deal[]) {
  return useMemo(() => computeRevenueKpis(deals), [deals]);
}