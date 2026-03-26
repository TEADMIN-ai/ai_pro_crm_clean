type ComplianceScoreDocument = {
  status?: string;
  verified?: boolean;
};

type ComplianceScoreResult = {
  score: number;
  verified: number;
  pending: number;
  total: number;
};

export function calculateComplianceScore(
  documents: ComplianceScoreDocument[] = []
): ComplianceScoreResult {
  const total = documents.length;

  if (!total) {
    return {
      score: 0,
      verified: 0,
      pending: 0,
      total: 0,
    };
  }

  const verified = documents.filter(
    (d) => d?.status === "APPROVED" || (typeof d?.status !== "string" && d?.verified === true)
  ).length;
  const pending = total - verified;

  const score = Number(((verified / total) * 100).toFixed(1));

  return {
    score,
    verified,
    pending,
    total,
  };
}
