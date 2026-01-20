import { Deal } from '@/types/deal';
import { KPI_DEFINITIONS } from '@/config/kpiDefinitions';

export function useKPIs(deals: Deal[] | undefined, role: string) {
  if (!Array.isArray(deals)) {
    return [];
  }

  return KPI_DEFINITIONS
    .filter(kpi => kpi.roles.includes(role))
    .map(kpi => ({
      key: kpi.key,
      label: kpi.label,
      value: kpi.compute(deals),
    }));
}