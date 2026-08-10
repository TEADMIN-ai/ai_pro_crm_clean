export const EVIDENCE_SIGNED_URL_TTL_MS = 5 * 60 * 1000;

export type GovernedEvidencePrefix =
  | "supplier-quotes/"
  | "hygiene/signatures/"
  | "hygiene/evidence/"
  | "hygiene/compliance/"
  | "contractors/"
  | "tenders/"
  | "tenderPacks/"
  | "tender-pack-tests/"
  | "uploads/deals/"
  | "qs/boq/";

export const GOVERNED_EVIDENCE_PREFIXES: readonly GovernedEvidencePrefix[] = [
  "supplier-quotes/",
  "hygiene/signatures/",
  "hygiene/evidence/",
  "hygiene/compliance/",
  "contractors/",
  "tenders/",
  "tenderPacks/",
  "tender-pack-tests/",
  "uploads/deals/",
  "qs/boq/",
];

export type StoragePathPolicyDecision = {
  allowed: boolean;
  normalizedPath: string | null;
  reason: string;
};

export function normalizeStorageObjectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const decoded = decodeURIComponent(trimmed);
    return decoded.trim();
  } catch {
    return trimmed;
  }
}

export function evaluateGovernedStoragePath(value: unknown, allowedPrefixes: readonly string[] = GOVERNED_EVIDENCE_PREFIXES): StoragePathPolicyDecision {
  const normalizedPath = normalizeStorageObjectPath(value);
  if (!normalizedPath) return { allowed: false, normalizedPath: null, reason: "Storage path is missing." };
  if (normalizedPath.startsWith("/") || normalizedPath.startsWith("\\")) {
    return { allowed: false, normalizedPath, reason: "Absolute storage paths are rejected." };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedPath) || /^gs:\/\//i.test(normalizedPath)) {
    return { allowed: false, normalizedPath, reason: "Arbitrary URL or bucket paths are rejected." };
  }
  if (normalizedPath.includes("\\") || normalizedPath.includes("\0")) {
    return { allowed: false, normalizedPath, reason: "Malformed storage path is rejected." };
  }
  const segments = normalizedPath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return { allowed: false, normalizedPath, reason: "Path traversal or empty path segments are rejected." };
  }
  if (!allowedPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
    return { allowed: false, normalizedPath, reason: "Storage path prefix is not approved for governed evidence." };
  }
  return { allowed: true, normalizedPath, reason: "Storage path is approved for governed evidence." };
}

export function expectedHygieneSignaturePath(input: { clientId: string; collectionId: string; signatureId: string }): string {
  return `hygiene/signatures/${input.clientId}/${input.collectionId}/${input.signatureId}.png`;
}

export function isExpectedHygieneCollectionEvidencePath(input: {
  path: string;
  clientId: string;
  collectionId: string;
}): boolean {
  return input.path.startsWith(`hygiene/evidence/${input.clientId}/${input.collectionId}/`) ||
    input.path.startsWith(`hygiene/signatures/${input.clientId}/${input.collectionId}/`);
}

export type EvidenceStorageReferenceClassification =
  | "DOCUMENT_REFERENCE"
  | "DURABLE_STORAGE_PATH"
  | "LEGACY_SIGNED_URL"
  | "UNRESOLVED_LEGACY_REFERENCE";

export type EvidenceStorageReferenceDecision = {
  classification: EvidenceStorageReferenceClassification;
  storagePath: string | null;
  reviewStatus: "ACCESS_READY" | "REVIEW_REQUIRED";
  reason: string;
};

export function classifyEvidenceStorageReference(input: { storagePath?: unknown; fileUrl?: unknown; documentId?: unknown; allowedPrefixes?: readonly string[]; }): EvidenceStorageReferenceDecision {
  const storagePath = normalizeStorageObjectPath(input.storagePath);
  if (storagePath) {
    const decision = evaluateGovernedStoragePath(storagePath, input.allowedPrefixes);
    return { classification: "DURABLE_STORAGE_PATH", storagePath: decision.allowed ? decision.normalizedPath : null, reviewStatus: decision.allowed ? "ACCESS_READY" : "REVIEW_REQUIRED", reason: decision.reason };
  }
  const documentId = typeof input.documentId === "string" && input.documentId.trim() ? input.documentId.trim() : null;
  if (documentId) return { classification: "DOCUMENT_REFERENCE", storagePath: null, reviewStatus: "REVIEW_REQUIRED", reason: "DocumentReference exists but no durable storage path is present." };
  const fileUrl = normalizeStorageObjectPath(input.fileUrl);
  if (!fileUrl) return { classification: "UNRESOLVED_LEGACY_REFERENCE", storagePath: null, reviewStatus: "REVIEW_REQUIRED", reason: "No evidence storage reference is present." };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(fileUrl) || /^gs:\/\//i.test(fileUrl)) {
    return { classification: "LEGACY_SIGNED_URL", storagePath: null, reviewStatus: "REVIEW_REQUIRED", reason: "Legacy signed URL is historical metadata and requires review before governed access." };
  }
  const decision = evaluateGovernedStoragePath(fileUrl, input.allowedPrefixes);
  return { classification: decision.allowed ? "DURABLE_STORAGE_PATH" : "UNRESOLVED_LEGACY_REFERENCE", storagePath: decision.allowed ? decision.normalizedPath : null, reviewStatus: decision.allowed ? "ACCESS_READY" : "REVIEW_REQUIRED", reason: decision.reason };
}
