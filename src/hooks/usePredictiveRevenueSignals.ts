"use client";

import { useMemo } from "react";
import type { Deal } from "@/types/deal";

import {
  computePredictiveRevenueSignals,
  type PredictiveRevenueSignals,
} from "@/lib/kpis/predictiveSignals";

/**
 * Predictive revenue intelligence hook
 * -----------------------------------
 * Derives forward-looking revenue signals from deal activity.
 *
 * SAFE:
 * - No side effects
 * - No Firestore
 * - No rendering
 */
export function usePredictiveRevenueSignals(
  deals: Deal[]
): PredictiveRevenueSignals {
  return useMemo(() => {
    return computePredictiveRevenueSignals(deals);
  }, [deals]);
}

