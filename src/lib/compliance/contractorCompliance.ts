import type { ContractorDocument } from "@/types/document";

export const SUPPORTED_DOCUMENT_TYPES = [
  "cipc",
  "bbbee",
  "taxClearance",
  "coida",
  "bankConfirmation",
] as const;

export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];
export const LEGACY_COMPLIANCE_REQUIREMENT_KEYS = ["cipc", "tax", "bbbee", "coida", "bank"] as const;
export type LegacyComplianceRequirementKey = (typeof LEGACY_COMPLIANCE_REQUIREMENT_KEYS)[number];

export type ContractorComplianceSummary = {
  readinessScore: number;
  complianceStatusScore: number;
  docsMissing: number;
  missingDocumentTypes: SupportedDocumentType[];
  tenderLockStatus: "READY" | "RISK" | "BLOCKED";
  isTenderLocked: boolean;
  expiredDocumentCount: number;
  expiringSoonCount: number;
  activeAlerts: number;
};

export type ContractorDocumentStatus = "missing" | "uploaded" | "verified" | "invalid" | "expired" | "expiringSoon";

function normalizeDocumentTypeToken(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

export function normalizeSupportedDocumentType(value: unknown): SupportedDocumentType | null {
  const normalized = normalizeDocumentTypeToken(value);

  switch (normalized) {
    case "cipc":
      return "cipc";
    case "bbbee":
    case "bbee":
      return "bbbee";
    case "tax":
    case "taxclearance":
    case "taxcompliance":
    case "taxcompliancestatus":
    case "tcspin":
    case "tcspindocument":
    case "legacytaxclearancecertificate":
      return "taxClearance";
    case "coida":
      return "coida";
    case "bank":
    case "bankconfirmation":
    case "bankletter":
      return "bankConfirmation";
    default:
      return null;
  }
}

export function toLegacyComplianceRequirementKey(value: unknown): LegacyComplianceRequirementKey | null {
  const normalized = normalizeSupportedDocumentType(value);

  switch (normalized) {
    case "cipc":
      return "cipc";
    case "bbbee":
      return "bbbee";
    case "taxClearance":
      return "tax";
    case "coida":
      return "coida";
    case "bankConfirmation":
      return "bank";
    default:
      return null;
  }
}

export function isSupportedDocumentType(value: string): value is SupportedDocumentType {
  return normalizeSupportedDocumentType(value) !== null;
}

export function getDocumentTypeLabel(type: SupportedDocumentType): string {
  switch (type) {
    case "cipc":
      return "CIPC";
    case "bbbee":
      return "BBBEE";
    case "taxClearance":
      return "Tax Clearance";
    case "coida":
      return "COIDA";
    case "bankConfirmation":
      return "Bank Confirmation";
  }
}

export function normalizeDocsMissingCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (value === true) {
    return 1;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  return 0;
}

export function resolveTenderLockStatusFromScore(score: number): ContractorComplianceSummary["tenderLockStatus"] {
  if (score < 60) {
    return "BLOCKED";
  }

  if (score < 80) {
    return "RISK";
  }

  return "READY";
}

export function resolveContractorDocumentStatus(
  document: Pick<ContractorDocument, "fileUrl" | "verified" | "verifiedAt" | "validationError" | "expiresAt" | "status">,
  now = Date.now()
): ContractorDocumentStatus {
  if (!document.fileUrl) {
    return "missing";
  }

  if (
    document.status === "expired" ||
    document.status === "invalid" ||
    document.status === "verified" ||
    document.status === "expiringSoon"
  ) {
    return document.status;
  }

  if (typeof document.expiresAt === "number" && document.expiresAt <= now) {
    return "expired";
  }

  if (document.status === "expiringSoon" && document.verified === true) {
    return "expiringSoon";
  }

  if (document.verified === true || typeof document.verifiedAt === "number") {
    return "verified";
  }

  if (document.verified === false && typeof document.validationError === "string" && document.validationError.trim()) {
    return "invalid";
  }

  return "uploaded";
}

export function calculateContractorCompliance(documents: ContractorDocument[]): ContractorComplianceSummary {
  const verifiedTypes = new Set<SupportedDocumentType>();
  const now = Date.now();
  let expiredDocumentCount = 0;
  let expiringSoonCount = 0;
  let complianceScoreTotal = 0;

  for (const document of documents) {
    const normalizedType = normalizeSupportedDocumentType(document.documentType ?? document.docType);
    if (!normalizedType) {
      continue;
    }

    const status = resolveContractorDocumentStatus(document, now);
    if (status === "verified" || status === "expiringSoon") {
      verifiedTypes.add(normalizedType);
    }
    if (status === "expired") {
      expiredDocumentCount += 1;
    }
    if (status === "expiringSoon") {
      expiringSoonCount += 1;
    }

    complianceScoreTotal +=
      typeof document.complianceScore === "number" && Number.isFinite(document.complianceScore)
        ? document.complianceScore
        : status === "verified"
          ? 100
          : status === "expiringSoon"
            ? 75
            : status === "uploaded"
              ? 25
              : 0;
  }

  const missingDocumentTypes = SUPPORTED_DOCUMENT_TYPES.filter((type) => !verifiedTypes.has(type));
  const docsMissing = missingDocumentTypes.length;
  const readinessScore = Math.round((verifiedTypes.size / SUPPORTED_DOCUMENT_TYPES.length) * 100);
  const complianceStatusScore = Math.round(complianceScoreTotal / SUPPORTED_DOCUMENT_TYPES.length);
  const tenderLockStatus = docsMissing > 0 ? "BLOCKED" : resolveTenderLockStatusFromScore(readinessScore);

  return {
    readinessScore,
    complianceStatusScore,
    docsMissing,
    missingDocumentTypes,
    tenderLockStatus,
    isTenderLocked: tenderLockStatus === "BLOCKED",
    expiredDocumentCount,
    expiringSoonCount,
    activeAlerts: expiredDocumentCount + expiringSoonCount,
  };
}
