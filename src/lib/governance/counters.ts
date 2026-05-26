type GovernanceCounterInput = {
  counterName: string;
  routeClassification?: string | null;
  sourceName?: string | null;
  routePath?: string | null;
  eventCategory?: string | null;
  contractorId?: string | null;
  dealId?: string | null;
};

export type GovernanceCounterSnapshot = {
  counterName: string;
  counterValue: number;
  routeClassification: string | null;
  sourceName: string | null;
  routePath: string | null;
  eventCategory: string | null;
  contractorId: string | null;
  dealId: string | null;
  aggregationKey: string;
  aggregatedAt: string;
};

const governanceCounters = new Map<string, GovernanceCounterSnapshot>();

function normalizePart(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value.trim() : "*";
}

function buildAggregationKey(input: GovernanceCounterInput): string {
  return [
    input.counterName,
    normalizePart(input.routeClassification),
    normalizePart(input.sourceName),
    normalizePart(input.routePath),
    normalizePart(input.eventCategory),
    normalizePart(input.contractorId),
    normalizePart(input.dealId),
  ].join("|");
}

export function incrementGovernanceCounter(
  input: GovernanceCounterInput
): GovernanceCounterSnapshot {
  const aggregationKey = buildAggregationKey(input);
  const nextValue = (governanceCounters.get(aggregationKey)?.counterValue ?? 0) + 1;
  const snapshot = {
    counterName: input.counterName,
    counterValue: nextValue,
    routeClassification: input.routeClassification ?? null,
    sourceName: input.sourceName ?? null,
    routePath: input.routePath ?? null,
    eventCategory: input.eventCategory ?? null,
    contractorId: input.contractorId ?? null,
    dealId: input.dealId ?? null,
    aggregationKey,
    aggregatedAt: new Date().toISOString(),
  };

  governanceCounters.set(aggregationKey, snapshot);

  return snapshot;
}

export function getGovernanceCounterSnapshots(): GovernanceCounterSnapshot[] {
  return Array.from(governanceCounters.values()).sort((left, right) => right.counterValue - left.counterValue);
}
