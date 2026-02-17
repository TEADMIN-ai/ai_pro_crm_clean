// src/lib/command/computeCommandState.ts

import type { Deal } from "@/types/deal";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";

export type EscalationLevel = 0 | 1 | 2 | 3;

export interface CommandState {
  overallStatus: "stable" | "watch" | "critical";
  activeAlerts: string[];
  escalationLevel: EscalationLevel;
  recommendedActions: string[];
}

export function computeCommandState(deals: Deal[]): CommandState {
  const alerts: string[] = [];
  const actions: string[] = [];

  let escalationCounter = 0;

  /* =========================
     RISK ANALYSIS
  ========================= */

  const risks = deals.map((d) => computeDealRisk(d));

  const criticalDeals = risks.filter((r) => r.level === "critical").length;
  const highRiskDeals = risks.filter((r) => r.level === "high").length;

  if (criticalDeals > 0) {
    alerts.push(`${criticalDeals} critical risk deal(s) detected`);
    actions.push("Immediate executive intervention required");
    escalationCounter += 2;
  }

  if (highRiskDeals > 2) {
    alerts.push("Multiple high risk deals detected");
    actions.push("Risk mitigation review session required");
    escalationCounter += 1;
  }

  /* =========================
     OPERATIONAL BLOCKS
  ========================= */

  const stuckInManagerReview = deals.filter(
    (d) => d.stage === "manager_review"
  ).length;

  if (stuckInManagerReview > 3) {
    alerts.push("Execution bottleneck in manager review");
    actions.push("Reallocate approval authority or add reviewers");
    escalationCounter += 1;
  }

  /* =========================
     CONVERSION HEALTH
  ========================= */

  const submitted = deals.filter((d) => d.stage === "submitted").length;
  const won = deals.filter((d) => d.stage === "won").length;

  const conversion =
    submitted > 0 ? (won / submitted) * 100 : 0;

  if (conversion < 25 && submitted > 5) {
    alerts.push("Low submission conversion rate");
    actions.push("Audit pricing and qualification process");
    escalationCounter += 1;
  }

  /* =========================
     ESCALATION CLAMP
  ========================= */

  const escalationLevel: EscalationLevel =
    escalationCounter >= 3
      ? 3
      : escalationCounter === 2
      ? 2
      : escalationCounter === 1
      ? 1
      : 0;

  /* =========================
     OVERALL STATUS
  ========================= */

  const overallStatus =
    escalationLevel >= 3
      ? "critical"
      : escalationLevel >= 1
      ? "watch"
      : "stable";

  return {
    overallStatus,
    activeAlerts: alerts,
    escalationLevel,
    recommendedActions: actions,
  };
}

