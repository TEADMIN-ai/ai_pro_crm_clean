export type RiskStatus = "open" | "monitoring" | "mitigated";

export interface Risk {
  id: string;
  riskTitle: string;
  riskDescription: string;
  riskCategory: string;
  riskScore: number;
  mitigationPlan: string;
  owner: string;
  status: RiskStatus;
  createdAt: string;
  updatedAt: string;
  createdByUid?: string;
  updatedByUid?: string;
}

export interface RiskMetrics {
  totalRisks: number;
  openRisks: number;
  monitoringRisks: number;
  mitigatedRisks: number;
  averageRiskScore: number;
}

export interface RiskRegisterSummary extends RiskMetrics {
  highPriorityRisks: number;
  byStatus: Record<RiskStatus, number>;
}

export interface CreateRiskInput {
  riskTitle: string;
  riskDescription: string;
  riskCategory: string;
  riskScore: number;
  mitigationPlan: string;
  owner: string;
  status: RiskStatus;
}

export interface UpdateRiskInput {
  riskTitle?: string;
  riskDescription?: string;
  riskCategory?: string;
  riskScore?: number;
  mitigationPlan?: string;
  owner?: string;
  status?: RiskStatus;
}

export type RiskRegisterEntry = Risk;
