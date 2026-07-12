export type ContractorMatchAction = "assign" | "review" | "compare";

export type ContractorMatchBucket = "recommended" | "assigned" | "pending-review" | "rejected";

export type ContractorMatchCompliance = "Ready" | "Review Required" | "Blocked";

export interface ContractorMatchRecommendation {
  contractorId: string;
  contractorName: string;
  bucket: ContractorMatchBucket;
  readinessScore: number;
  compliance: ContractorMatchCompliance;
  experience: string;
  requiredCertifications: string[];
  previousAwards: string[];
  currentWorkload: string;
  winRate: number;
  aiMatchScore: number;
  notes?: string | null;
}

export function sortContractorMatchesByScore(
  matches: ContractorMatchRecommendation[],
): ContractorMatchRecommendation[] {
  return [...matches].sort((left, right) => right.aiMatchScore - left.aiMatchScore);
}


export function groupContractorMatches(matches: ContractorMatchRecommendation[]) {
  const buckets: Record<ContractorMatchBucket, ContractorMatchRecommendation[]> = {
    recommended: [],
    assigned: [],
    "pending-review": [],
    rejected: [],
  };

  for (const match of sortContractorMatchesByScore(matches)) {
    buckets[match.bucket].push(match);
  }

  return buckets;
}
