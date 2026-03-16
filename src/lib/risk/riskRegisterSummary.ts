import type { RiskRegisterEntry, RiskRegisterSummary, RiskStatus } from "@/types/risk";

const HIGH_PRIORITY_RISK_SCORE = 4;

export function buildRiskRegisterSummary(risks: RiskRegisterEntry[]): RiskRegisterSummary {
  const byStatus: Record<RiskStatus, number> = {
    open: 0,
    monitoring: 0,
    mitigated: 0,
  };

  if (risks.length === 0) {
    return {
      totalRisks: 0,
      openRisks: 0,
      monitoringRisks: 0,
      mitigatedRisks: 0,
      highPriorityRisks: 0,
      averageRiskScore: 0,
      byStatus,
    };
  }

  let totalScore = 0;
  let highPriorityRisks = 0;

  for (const risk of risks) {
    byStatus[risk.status] += 1;
    totalScore += risk.riskScore;

    if (risk.riskScore >= HIGH_PRIORITY_RISK_SCORE) {
      highPriorityRisks += 1;
    }
  }

  return {
    totalRisks: risks.length,
    openRisks: byStatus.open,
    monitoringRisks: byStatus.monitoring,
    mitigatedRisks: byStatus.mitigated,
    highPriorityRisks,
    averageRiskScore: Math.round(totalScore / risks.length),
    byStatus,
  };
}
