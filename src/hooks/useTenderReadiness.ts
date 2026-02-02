import { useMemo } from "react";
import type { Deal } from "@/types/deal";
import {
  computeTenderReadiness,
  TenderReadinessResult,
} from "@/lib/tender/computeTenderReadiness";

/**
 * Hook wrapper around tender readiness intelligence.
 * Single source of truth: the Deal object.
 */
export function useTenderReadiness(deal: Deal): TenderReadinessResult {
  return useMemo(() => {
    return computeTenderReadiness(deal);
  }, [deal]);
}