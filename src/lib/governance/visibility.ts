import { getGovernanceCounterSnapshots, type GovernanceCounterSnapshot } from "@/lib/governance/counters";
import { getRecentGovernanceEvents } from "@/lib/governance/store";
import type { GovernanceEvent } from "@/lib/governance/types";

type GovernanceKpi = {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  detail: string;
};

type GovernanceRouteMetric = {
  routeKey: string;
  sourceName: string;
  routePath: string | null;
  routeClassification: string | null;
  activityFrequency: number;
  divergenceFrequency: number;
  staleStateCompensationFrequency: number;
  canonicalCorrectionFrequency: number;
};

export type GovernanceVisibilitySnapshot = {
  capturedAt: string;
  kpis: GovernanceKpi[];
  routeMetrics: GovernanceRouteMetric[];
  recentEvents: GovernanceEvent[];
  canonicalActivityRatio: number;
  legacyActivityRatio: number;
  routeClassificationDistribution: Array<{
    classification: string;
    count: number;
  }>;
  driftIndicators: Array<{
    label: string;
    value: number;
  }>;
};

function sumCounter(
  snapshots: GovernanceCounterSnapshot[],
  counterName: string
): number {
  return snapshots
    .filter((snapshot) => snapshot.counterName === counterName)
    .reduce((total, snapshot) => total + snapshot.counterValue, 0);
}

function toTone(value: number, thresholds: { warning: number; danger: number }): GovernanceKpi["tone"] {
  if (value >= thresholds.danger) return "danger";
  if (value >= thresholds.warning) return "warning";
  return "success";
}

function buildRouteMetrics(snapshots: GovernanceCounterSnapshot[]): GovernanceRouteMetric[] {
  const routeMap = new Map<string, GovernanceRouteMetric>();

  for (const snapshot of snapshots) {
    const routeKey = [
      snapshot.sourceName ?? "unknown",
      snapshot.routePath ?? "*",
      snapshot.routeClassification ?? "*",
    ].join("|");

    const existing = routeMap.get(routeKey) ?? {
      routeKey,
      sourceName: snapshot.sourceName ?? "unknown",
      routePath: snapshot.routePath ?? null,
      routeClassification: snapshot.routeClassification ?? null,
      activityFrequency: 0,
      divergenceFrequency: 0,
      staleStateCompensationFrequency: 0,
      canonicalCorrectionFrequency: 0,
    };

    if (snapshot.counterName === "route_level_governance_activity") {
      existing.activityFrequency += snapshot.counterValue;
    }

    if (snapshot.counterName === "divergence_frequency") {
      existing.divergenceFrequency += snapshot.counterValue;
    }

    if (snapshot.counterName === "stale_state_compensation_frequency") {
      existing.staleStateCompensationFrequency += snapshot.counterValue;
    }

    if (snapshot.counterName === "canonical_correction_frequency") {
      existing.canonicalCorrectionFrequency += snapshot.counterValue;
    }

    routeMap.set(routeKey, existing);
  }

  return Array.from(routeMap.values()).sort((left, right) => {
    return (
      right.activityFrequency +
      right.divergenceFrequency +
      right.staleStateCompensationFrequency +
      right.canonicalCorrectionFrequency -
      (left.activityFrequency +
        left.divergenceFrequency +
        left.staleStateCompensationFrequency +
        left.canonicalCorrectionFrequency)
    );
  });
}

function buildClassificationDistribution(events: GovernanceEvent[]) {
  const distribution = new Map<string, number>();

  for (const event of events) {
    const classification =
      event.governance.routeClassification ??
      event.source.sourceClassification ??
      "unknown";
    distribution.set(classification, (distribution.get(classification) ?? 0) + 1);
  }

  return Array.from(distribution.entries())
    .map(([classification, count]) => ({ classification, count }))
    .sort((left, right) => right.count - left.count);
}

export function getGovernanceVisibilitySnapshot(): GovernanceVisibilitySnapshot {
  const counterSnapshots = getGovernanceCounterSnapshots();
  const recentEvents = getRecentGovernanceEvents(24).filter((event) =>
    event.eventType === "stale_state_compensation_observed" ||
    event.eventType === "legacy_canonical_divergence_observed" ||
    event.eventType === "canonical_overwrite_after_legacy_write_observed" ||
    event.eventType === "deals_get_side_effect_recompute_observed"
  );

  const totalGovernanceActivity = sumCounter(counterSnapshots, "route_level_governance_activity");
  const legacyMutationFrequency = sumCounter(counterSnapshots, "legacy_mutation_frequency");
  const canonicalCorrectionFrequency = sumCounter(counterSnapshots, "canonical_correction_frequency");
  const staleStateCompensationFrequency = sumCounter(counterSnapshots, "stale_state_compensation_frequency");
  const divergenceFrequency = sumCounter(counterSnapshots, "divergence_frequency");
  const noopRecomputeFrequency = sumCounter(counterSnapshots, "noop_recompute_frequency");

  const recentAllEvents = getRecentGovernanceEvents(180);
  const canonicalCount = recentAllEvents.filter((event) => event.governance.routeClassification === "canonical").length;
  const legacyCount = recentAllEvents.filter((event) => event.governance.routeClassification === "legacy").length;
  const trackedCount = canonicalCount + legacyCount;

  const canonicalActivityRatio = trackedCount > 0 ? canonicalCount / trackedCount : 0;
  const legacyActivityRatio = trackedCount > 0 ? legacyCount / trackedCount : 0;

  return {
    capturedAt: new Date().toISOString(),
    kpis: [
      {
        label: "Total Governance Activity",
        value: totalGovernanceActivity,
        tone: "info",
        detail: "Emitter-level route and service visibility activity.",
      },
      {
        label: "Legacy Mutations",
        value: legacyMutationFrequency,
        tone: toTone(legacyMutationFrequency, { warning: 3, danger: 8 }),
        detail: "Observed writes outside canonical truth ownership.",
      },
      {
        label: "Canonical Corrections",
        value: canonicalCorrectionFrequency,
        tone: toTone(canonicalCorrectionFrequency, { warning: 2, danger: 6 }),
        detail: "Canonical overwrites following legacy path activity.",
      },
      {
        label: "Stale-State Compensation",
        value: staleStateCompensationFrequency,
        tone: toTone(staleStateCompensationFrequency, { warning: 2, danger: 6 }),
        detail: "Passive corrections triggered by drift or outdated derived state.",
      },
      {
        label: "Divergence Frequency",
        value: divergenceFrequency,
        tone: toTone(divergenceFrequency, { warning: 3, danger: 8 }),
        detail: "Observed canonical versus legacy mismatch activity.",
      },
      {
        label: "No-op Recomputation",
        value: noopRecomputeFrequency,
        tone: noopRecomputeFrequency > 0 ? "neutral" : "success",
        detail: "Read-side recomputation passes that changed nothing operationally.",
      },
    ],
    routeMetrics: buildRouteMetrics(counterSnapshots).slice(0, 8),
    recentEvents,
    canonicalActivityRatio,
    legacyActivityRatio,
    routeClassificationDistribution: buildClassificationDistribution(recentAllEvents),
    driftIndicators: [
      { label: "Divergence Load", value: divergenceFrequency },
      { label: "Correction Pressure", value: canonicalCorrectionFrequency },
      { label: "Legacy Mutation Load", value: legacyMutationFrequency },
    ],
  };
}
