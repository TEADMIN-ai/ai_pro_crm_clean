import { useState, useEffect } from "react";
import { Deal } from "@/types/deal";
import { computeRevenueIntelligence } from "@/lib/kpis/revenueIntelligence";

export function useRevenueIntelligence(deals: Deal[]) {
  const [stats, setStats] = useState({
    total: 0,
    weighted: 0,
  });

  useEffect(() => {
    setStats(computeRevenueIntelligence(deals));
  }, [deals]);

  return stats;
}

