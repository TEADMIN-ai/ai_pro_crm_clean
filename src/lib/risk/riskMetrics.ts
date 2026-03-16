import type { Risk, RiskMetrics } from "@/types/risk";

export function buildRiskMetrics(risks: Risk[]): RiskMetrics {
  if (risks.length === 0) {
    return {
      totalRisks: 0,
      openRisks: 0,
      monitoringRisks: 0,
      mitigatedRisks: 0,
      averageRiskScore: 0,
    };
  }

  let totalScore = 0;
  let openRisks = 0;
  let monitoringRisks = 0;
  let mitigatedRisks = 0;

  for (const risk of risks) {
    totalScore += risk.riskScore;

    if (risk.status === "open") {
      openRisks += 1;
    } else if (risk.status === "monitoring") {
      monitoringRisks += 1;
    } else {
      mitigatedRisks += 1;
    }
  }

  return {
    totalRisks: risks.length,
    openRisks,
    monitoringRisks,
    mitigatedRisks,
    averageRiskScore: Number((totalScore / risks.length).toFixed(2)),
  };
}
