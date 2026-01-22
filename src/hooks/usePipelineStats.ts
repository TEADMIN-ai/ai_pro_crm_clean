import type { Deal } from "@/types/deal";

export function usePipelineStats(deals: Deal[]) {
  const stats: Record<string, number> = {};

  for (const deal of deals ?? []) {
    const stage = (deal as any)?.stage;
    if (!stage) continue;
    const key = String(stage);
    stats[key] = (stats[key] ?? 0) + 1;
  }

  return stats;
}
