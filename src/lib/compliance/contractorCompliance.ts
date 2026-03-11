import type { ContractorDocument } from "@/types/document";

export const SUPPORTED_DOCUMENT_TYPES = [
  "cipc",
  "bbbee",
  "taxClearance",
  "coida",
  "bankConfirmation",
] as const;

export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];

export type ContractorComplianceSummary = {
  readinessScore: number;
  docsMissing: number;
  missingDocumentTypes: SupportedDocumentType[];
  tenderLockStatus: "READY" | "RISK" | "BLOCKED";
  isTenderLocked: boolean;
};

export type ContractorDocumentStatus = "missing" | "uploaded" | "verified" | "invalid" | "expired" | "expiringSoon";

export function isSupportedDocumentType(value: string): value is SupportedDocumentType {
  return (SUPPORTED_DOCUMENT_TYPES as readonly string[]).includes(value);
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
  document: Pick<ContractorDocument, "fileUrl" | "verified" | "validationError" | "expiresAt" | "status">,
  now = Date.now()
): ContractorDocumentStatus {
  if (!document.fileUrl) {
    return "missing";
  }

  if (typeof document.expiresAt === "number" && document.expiresAt <= now) {
    return "expired";
  }

  if (document.status === "expiringSoon" && document.verified === true) {
    return "expiringSoon";
  }

  if (document.verified === true) {
    return "verified";
  }

  if (document.verified === false && typeof document.validationError === "string" && document.validationError.trim()) {
    return "invalid";
  }

  if (
    document.status === "expired" ||
    document.status === "invalid" ||
    document.status === "verified" ||
    document.status === "expiringSoon"
  ) {
    return document.status;
  }

  return "uploaded";
}

export function calculateContractorCompliance(documents: ContractorDocument[]): ContractorComplianceSummary {
  const verifiedTypes = new Set<SupportedDocumentType>();
  const now = Date.now();

  for (const document of documents) {
    const type = document.documentType ?? document.docType;
    if (!type || !isSupportedDocumentType(type)) {
      continue;
    }

    const status = resolveContractorDocumentStatus(document, now);
    if (status === "verified" || status === "expiringSoon") {
      verifiedTypes.add(type);
    }
  }

  const missingDocumentTypes = SUPPORTED_DOCUMENT_TYPES.filter((type) => !verifiedTypes.has(type));
  const docsMissing = missingDocumentTypes.length;
  const readinessScore = Math.round((verifiedTypes.size / SUPPORTED_DOCUMENT_TYPES.length) * 100);
  const tenderLockStatus = docsMissing > 0 ? "BLOCKED" : resolveTenderLockStatusFromScore(readinessScore);

  return {
    readinessScore,
    docsMissing,
    missingDocumentTypes,
    tenderLockStatus,
    isTenderLocked: tenderLockStatus === "BLOCKED",
  };
}
