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

export function calculateContractorCompliance(documents: ContractorDocument[]): ContractorComplianceSummary {
  const now = Date.now();
  const uploadedTypes = new Set<SupportedDocumentType>();
  let expiredDocuments = 0;
  let missingRegistrationNumbers = 0;
  let invalidBeeLevels = 0;

  for (const document of documents) {
    const type = document.documentType ?? document.docType;
    if (type && isSupportedDocumentType(type) && document.fileUrl) {
      uploadedTypes.add(type);

      if (typeof document.expiresAt === "number" && document.expiresAt < now) {
        expiredDocuments += 1;
      }

      const extractedFields = document.extractedFields ?? {};
      if (
        type === "cipc" &&
        (!extractedFields.companyRegistrationNumber || !String(extractedFields.companyRegistrationNumber).trim())
      ) {
        missingRegistrationNumbers += 1;
      }

      if (
        type === "coida" &&
        (!extractedFields.employerRegistrationNumber || !String(extractedFields.employerRegistrationNumber).trim())
      ) {
        missingRegistrationNumbers += 1;
      }

      if (type === "bbbee") {
        const beeLevel = typeof extractedFields.beeLevel === "string" ? extractedFields.beeLevel.trim() : "";
        if (beeLevel && !/\b([1-8])\b/.test(beeLevel)) {
          invalidBeeLevels += 1;
        }
      }
    }
  }

  const missingDocumentTypes = SUPPORTED_DOCUMENT_TYPES.filter((type) => !uploadedTypes.has(type));
  const docsMissing =
    missingDocumentTypes.length + expiredDocuments + missingRegistrationNumbers + invalidBeeLevels;
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        missingDocumentTypes.length * 20 -
        expiredDocuments * 15 -
        missingRegistrationNumbers * 10 -
        invalidBeeLevels * 10
    )
  );
  const tenderLockStatus =
    missingDocumentTypes.length > 0 || expiredDocuments > 0 || missingRegistrationNumbers > 0
      ? "BLOCKED"
      : invalidBeeLevels > 0
        ? "RISK"
        : resolveTenderLockStatusFromScore(readinessScore);

  return {
    readinessScore,
    docsMissing,
    missingDocumentTypes,
    tenderLockStatus,
    isTenderLocked: tenderLockStatus === "BLOCKED",
  };
}
