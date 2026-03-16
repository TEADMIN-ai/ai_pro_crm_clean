import type { ComplianceDocumentStatus } from "@/lib/compliance/analyzeComplianceDocument";
import type { ContractorDocument } from "@/types/document";

export type ComplianceExpiryAlertState = "none" | "expiringSoon" | "expired";

const EXPIRY_WARNING_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function resolveComplianceExpiryAlert(
  expiresAt: number | null | undefined,
  now = Date.now(),
): { state: ComplianceExpiryAlertState; daysUntilExpiry: number | null; message: string | null } {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return { state: "none", daysUntilExpiry: null, message: null };
  }

  const daysUntilExpiry = Math.ceil((expiresAt - now) / DAY_IN_MS);

  if (expiresAt <= now) {
    return {
      state: "expired",
      daysUntilExpiry,
      message: "Compliance document has expired and requires immediate renewal.",
    };
  }

  if (expiresAt <= now + EXPIRY_WARNING_DAYS * DAY_IN_MS) {
    return {
      state: "expiringSoon",
      daysUntilExpiry,
      message: `Compliance document expires in ${daysUntilExpiry} day(s).`,
    };
  }

  return { state: "none", daysUntilExpiry, message: null };
}

export function computeComplianceScore(params: {
  status: ComplianceDocumentStatus | "missing";
  confidenceScore?: number | null;
}): number {
  const confidence = typeof params.confidenceScore === "number" && Number.isFinite(params.confidenceScore)
    ? Math.max(0, Math.min(1, params.confidenceScore))
    : 0;

  switch (params.status) {
    case "verified":
      return 80 + Math.round(confidence * 20);
    case "expiringSoon":
      return 60 + Math.round(confidence * 20);
    case "uploaded":
      return 25 + Math.round(confidence * 25);
    case "invalid":
      return Math.round(confidence * 20);
    case "expired":
    case "missing":
    default:
      return 0;
  }
}

export function computeAggregateComplianceScore(documents: ContractorDocument[]): number {
  if (documents.length === 0) {
    return 0;
  }

  const total = documents.reduce((sum, document) => {
    if (typeof document.complianceScore === "number" && Number.isFinite(document.complianceScore)) {
      return sum + document.complianceScore;
    }

    return sum + computeComplianceScore({
      status: (document.status as ComplianceDocumentStatus | "missing" | undefined) ?? "missing",
      confidenceScore: document.confidenceScore,
    });
  }, 0);

  return Math.round(total / documents.length);
}
