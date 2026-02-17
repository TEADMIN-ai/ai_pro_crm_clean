import { useMemo } from "react";
import type { Deal } from "@/types/deal";
import { KPI_DEFINITIONS } from "@/config/kpiDefinitions";

export function useKPIs(deals: Deal[]) {
  return useMemo(() => {
    return KPI_DEFINITIONS.map((kpi) => ({
      label: kpi.label,
      value: kpi.value(deals),
    }));
  }, [deals]);
}

