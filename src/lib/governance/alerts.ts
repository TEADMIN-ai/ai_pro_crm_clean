import type { GovernanceVisibilitySnapshot } from "@/lib/governance/visibility";

export type GovernanceAlertSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type GovernanceAlert = {
  id: string;
  alertType:
    | "repeated_stale_state_compensation"
    | "high_divergence_route_activity"
    | "canonical_correction_spike"
    | "governance_drift_concentration"
    | "noop_recompute_waste";
  severity: GovernanceAlertSeverity;
  title: string;
  summary: string;
  sourceName?: string | null;
  routePath?: string | null;
  contractorId?: string | null;
  dealId?: string | null;
  metrics: {
    activityFrequency?: number;
    divergenceFrequency?: number;
    staleStateCompensationFrequency?: number;
    canonicalCorrectionFrequency?: number;
    noopRecomputeFrequency?: number;
    legacyActivityRatio?: number;
  };
  routeClassification?: string | null;
  observedAt: string;
};

function severityRank(severity: GovernanceAlertSeverity): number {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MODERATE":
      return 2;
    case "LOW":
    default:
      return 1;
  }
}

function buildAlertId(prefix: string, routePath?: string | null): string {
  return `${prefix}:${routePath ?? "global"}`;
}

function buildSeverity(value: number, thresholds: { moderate: number; high: number; critical: number }): GovernanceAlertSeverity {
  if (value >= thresholds.critical) return "CRITICAL";
  if (value >= thresholds.high) return "HIGH";
  if (value >= thresholds.moderate) return "MODERATE";
  return "LOW";
}

function extractKpiValue(snapshot: GovernanceVisibilitySnapshot, label: string): number {
  return snapshot.kpis.find((kpi) => kpi.label === label)?.value ?? 0;
}

export function getGovernanceAlerts(snapshot: GovernanceVisibilitySnapshot): GovernanceAlert[] {
  const alerts: GovernanceAlert[] = [];
  const observedAt = snapshot.capturedAt;

  const noopRecomputeFrequency = extractKpiValue(snapshot, "No-op Recomputation");
  const staleStateCompensationFrequency = extractKpiValue(snapshot, "Stale-State Compensation");
  const canonicalCorrectionFrequency = extractKpiValue(snapshot, "Canonical Corrections");
  const divergenceFrequency = extractKpiValue(snapshot, "Divergence Frequency");

  if (staleStateCompensationFrequency >= 3) {
    alerts.push({
      id: buildAlertId("repeated_stale_state_compensation"),
      alertType: "repeated_stale_state_compensation",
      severity: buildSeverity(staleStateCompensationFrequency, { moderate: 3, high: 6, critical: 10 }),
      title: "Repeated stale-state compensation",
      summary: "Passive observations show recurring readiness correction pressure across legacy flows.",
      metrics: {
        staleStateCompensationFrequency,
      },
      observedAt,
    });
  }

  if (canonicalCorrectionFrequency >= 2) {
    alerts.push({
      id: buildAlertId("canonical_correction_spike"),
      alertType: "canonical_correction_spike",
      severity: buildSeverity(canonicalCorrectionFrequency, { moderate: 2, high: 5, critical: 8 }),
      title: "Canonical correction spike",
      summary: "Canonical truth is overwriting legacy-derived state often enough to warrant operator review.",
      metrics: {
        canonicalCorrectionFrequency,
      },
      observedAt,
    });
  }

  if (noopRecomputeFrequency >= 3) {
    alerts.push({
      id: buildAlertId("noop_recompute_waste"),
      alertType: "noop_recompute_waste",
      severity: buildSeverity(noopRecomputeFrequency, { moderate: 3, high: 7, critical: 12 }),
      title: "No-op recompute waste",
      summary: "Read-side recomputation is being exercised without materially changing derived state.",
      metrics: {
        noopRecomputeFrequency,
      },
      observedAt,
    });
  }

  if (snapshot.legacyActivityRatio >= 0.55 && divergenceFrequency >= 3) {
    alerts.push({
      id: buildAlertId("governance_drift_concentration"),
      alertType: "governance_drift_concentration",
      severity:
        snapshot.legacyActivityRatio >= 0.75
          ? "CRITICAL"
          : snapshot.legacyActivityRatio >= 0.65
            ? "HIGH"
            : "MODERATE",
      title: "Governance drift concentration",
      summary: "Legacy-classified activity dominates the recent governance surface while divergence remains active.",
      metrics: {
        divergenceFrequency,
        legacyActivityRatio: snapshot.legacyActivityRatio,
      },
      observedAt,
    });
  }

  for (const route of snapshot.routeMetrics) {
    const routePressure =
      route.divergenceFrequency +
      route.staleStateCompensationFrequency +
      route.canonicalCorrectionFrequency;

    if (routePressure < 4) {
      continue;
    }

    alerts.push({
      id: buildAlertId("high_divergence_route_activity", route.routePath ?? route.sourceName),
      alertType: "high_divergence_route_activity",
      severity: buildSeverity(routePressure, { moderate: 4, high: 8, critical: 12 }),
      title: "High divergence route activity",
      summary: `${route.sourceName} is accumulating governance instability signals above passive visibility thresholds.`,
      sourceName: route.sourceName,
      routePath: route.routePath,
      routeClassification: route.routeClassification,
      metrics: {
        activityFrequency: route.activityFrequency,
        divergenceFrequency: route.divergenceFrequency,
        staleStateCompensationFrequency: route.staleStateCompensationFrequency,
        canonicalCorrectionFrequency: route.canonicalCorrectionFrequency,
      },
      observedAt,
    });
  }

  return alerts.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

export function getRouteAlertSeverityMap(alerts: GovernanceAlert[]): Record<string, GovernanceAlertSeverity> {
  const routeAlerts = alerts.filter((alert) => alert.routePath || alert.sourceName);
  const severityByRoute: Record<string, GovernanceAlertSeverity> = {};

  for (const alert of routeAlerts) {
    const key = [alert.sourceName ?? "unknown", alert.routePath ?? "*"].join("|");
    const current = severityByRoute[key];
    if (!current || severityRank(alert.severity) > severityRank(current)) {
      severityByRoute[key] = alert.severity;
    }
  }

  return severityByRoute;
}
