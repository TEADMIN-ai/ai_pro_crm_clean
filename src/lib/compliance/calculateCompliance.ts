import type { ContractorDocument } from "@/types/document";

export type ComplianceResult = {
  score: number;
  compliancePercentage: number;
  expired: number;
  expiring: number;
  expiringSoon: number;
  valid: number;
  total: number;
  status: "READY" | "WARNING" | "NON_COMPLIANT";
};

const EXPIRY_WARNING_DAYS = 30;

export function calculateCompliance(
  documents: ContractorDocument[]
): ComplianceResult {

  const now = Date.now();
  const warningThreshold = now + (EXPIRY_WARNING_DAYS * 86400000);

  let expired = 0;
  let expiringSoon = 0;
  let valid = 0;

  for (const doc of documents) {

    if (!doc.expiresAt) {
      valid++;
      continue;
    }

    if (doc.expiresAt < now) {
      expired++;
    }
    else if (doc.expiresAt < warningThreshold) {
      expiringSoon++;
      valid++;
    }
    else {
      valid++;
    }
  }

  const total = documents.length;

  let score = 100;

  if (total > 0) {
    score = Math.round((valid / total) * 100);
  }

  let status: ComplianceResult["status"] = "READY";

  if (expired > 0) {
    status = "NON_COMPLIANT";
  }
  else if (expiringSoon > 0) {
    status = "WARNING";
  }

  return {
    score,
    compliancePercentage: score,
    expired,
    expiring: expiringSoon,
    expiringSoon,
    valid,
    total,
    status
  };
}
