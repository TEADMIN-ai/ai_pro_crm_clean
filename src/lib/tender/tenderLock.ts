export interface TenderLockResult {
  allowed: boolean;
  score: number;
  reason?: string;
}

export function validateTenderSubmission(
  score: number,
  docsMissing: number
): TenderLockResult {
  if (docsMissing > 0) {
    return {
      allowed: false,
      score,
      reason: "Mandatory compliance documents missing",
    };
  }

  if (score < 60) {
    return {
      allowed: false,
      score,
      reason: "Tender readiness score too low",
    };
  }

  if (score >= 60 && score < 80) {
    return {
      allowed: true,
      score,
      reason: "Submission allowed with risk warning",
    };
  }

  return {
    allowed: true,
    score,
  };
}
