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

function getDocumentTypeKey(document: Pick<ContractorDocument, "documentType" | "docType">): string | null {
  const type = document.documentType ?? document.docType;
  return typeof type === "string" && type.trim().length > 0 ? type.trim() : null;
}

function getDocumentRecency(document: Pick<ContractorDocument, "uploadedAt" | "createdAt" | "updatedAt">): number {
  if (typeof document.uploadedAt === "number" && Number.isFinite(document.uploadedAt)) {
    return document.uploadedAt;
  }

  if (typeof document.createdAt === "number" && Number.isFinite(document.createdAt)) {
    return document.createdAt;
  }

  if (typeof document.updatedAt === "number" && Number.isFinite(document.updatedAt)) {
    return document.updatedAt;
  }

  return 0;
}

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

  if (document.status === "APPROVED") {
    return "verified";
  }

  if (document.status === "REJECTED" || document.status === "FLAGGED") {
    return "invalid";
  }

  if (document.status === "PENDING_REVIEW") {
    return "uploaded";
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

export function getLatestDocumentsByType<T extends Pick<ContractorDocument, "documentType" | "docType" | "uploadedAt" | "createdAt" | "updatedAt">>(
  documents: T[]
): T[] {
  const latestDocsMap = new Map<string, T>();

  for (const document of documents) {
    const type = getDocumentTypeKey(document);
    if (!type) {
      continue;
    }

    const existing = latestDocsMap.get(type);
    if (!existing || getDocumentRecency(document) > getDocumentRecency(existing)) {
      latestDocsMap.set(type, document);
    }
  }

  return Array.from(latestDocsMap.values());
}

export function isSupersededDocument(
  document: Pick<ContractorDocument, "id" | "documentType" | "docType" | "uploadedAt" | "createdAt" | "updatedAt">,
  latestDocuments: Array<Pick<ContractorDocument, "id" | "documentType" | "docType" | "uploadedAt" | "createdAt" | "updatedAt">>
): boolean {
  const type = getDocumentTypeKey(document);
  if (!type) {
    return false;
  }

  return !latestDocuments.some((latestDocument) => latestDocument.id === document.id && getDocumentTypeKey(latestDocument) === type);
}

export function calculateContractorCompliance(documents: ContractorDocument[]): ContractorComplianceSummary {
  const latestDocuments = getLatestDocumentsByType(documents);
  const verifiedTypes = new Set<SupportedDocumentType>();
  const now = Date.now();
  let expiredDocumentCount = 0;
  let expiringSoonCount = 0;
  let complianceScoreTotal = 0;

  for (const document of latestDocuments) {
    const type = document.documentType ?? document.docType;
    if (!type || !isSupportedDocumentType(type)) {
      continue;
    }

    const status = resolveContractorDocumentStatus(document, now);
    if (status === "verified" || status === "expiringSoon") {
      verifiedTypes.add(type);
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
