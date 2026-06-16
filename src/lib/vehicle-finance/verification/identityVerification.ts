import type { VehicleFinanceIdentityDocumentIntelligence, VehicleFinanceIdentityVerification } from "@/types/vehicleFinance";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missing(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

export function verifyIdentityExtraction(
  extraction: VehicleFinanceIdentityDocumentIntelligence["extraction"],
): VehicleFinanceIdentityVerification {
  const flags: VehicleFinanceIdentityVerification["flags"] = [];
  let score = 100;

  if (missing(extraction.idNumber.value)) {
    flags.push("MISSING_ID_NUMBER");
    score -= 30;
  }

  if (missing(extraction.surname.value)) {
    flags.push("MISSING_SURNAME");
    score -= 20;
  }

  if (missing(extraction.forenames.value)) {
    flags.push("MISSING_FORENAMES");
    score -= 20;
  }

  if (missing(extraction.dateOfBirth.value)) {
    flags.push("MISSING_DATE_OF_BIRTH");
    score -= 30;
  }

  if (extraction.idNumber.confidence < 80) score -= 5;
  if (extraction.surname.confidence < 80) score -= 5;
  if (extraction.forenames.confidence < 80) score -= 5;
  if (extraction.dateOfBirth.confidence < 80) score -= 5;

  return {
    passed: flags.length === 0 && score >= 70,
    score: clamp(score),
    flags,
  };
}
