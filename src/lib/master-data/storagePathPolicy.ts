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
