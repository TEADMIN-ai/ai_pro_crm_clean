import { KPI_DEFINITIONS } from "@/config/kpiDefinitions";
import { Deal } from "@/types/deal";

export function useKPIs(
  deals: Deal[] | undefined,
  role: "admin" | "manager" | "staff",
  userId?: string
) {
  if (!Array.isArray(deals)) return [];

  return KPI_DEFINITIONS
    .filter((kpi) => kpi.roles.includes(role))
    .map((kpi) => ({
      key: kpi.key,
      label: kpi.label,
      value: kpi.compute(deals, userId),
      description: kpi.description,
    }));
}