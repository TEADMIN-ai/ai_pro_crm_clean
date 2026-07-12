export type ContractorMatchAction = "assign" | "review" | "reject";

export type ContractorMatchCompliance = "Ready" | "Review Required" | "Blocked";

export interface ContractorMatchRecommendation {
  contractorId: string;
  contractorName: string;
  readinessScore: number;
  compliance: ContractorMatchCompliance;
  experience: string;
  requiredCertifications: string[];
  previousAwards: string[];
  currentWorkload: string;
  aiMatchScore: number;
  notes?: string | null;
}

export function sortContractorMatchesByScore(
  matches: ContractorMatchRecommendation[],
): ContractorMatchRecommendation[] {
  return [...matches].sort((left, right) => right.aiMatchScore - left.aiMatchScore);
}

