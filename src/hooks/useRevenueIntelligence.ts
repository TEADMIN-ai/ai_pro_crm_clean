"use client";

import { useMemo } from "react";
import type { Deal } from "@/types/deal";
import {
  computeRevenueIntelligence,
  type RevenueIntelligence,
} from "@/lib/kpis/revenueIntelligence";

/**
 * Revenue Intelligence Hook
 *
 * - Single source of truth for revenue analytics
 * - Fully memoized
 * - Safe against empty / undefined deal arrays
 */
export function useRevenueIntelligence(
  deals: Deal[] | undefined
): RevenueIntelligence {
  return useMemo(
    () => computeRevenueIntelligence(Array.isArray(deals) ? deals : []),
    [deals]
  );
}