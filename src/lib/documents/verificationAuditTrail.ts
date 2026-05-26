function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return null;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value.trim());
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function normalizeExtractedFieldsSignature(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "null";
  }

  return stableSerialize(value);
}

interface NormalizedVerificationAuditEntry {
  action: string | null;
  by: string | null;
  at: string | null;
  atMillis: number | null;
  source: string | null;
  verificationStatus: string | null;
  aiStatus: string | null;
  extractedFieldsSignature: string | null;
}

export interface VerificationAuditEntryInput {
  actor: string;
  at: string;
  source: string;
  verificationStatus: string | null;
  aiStatus: string | null;
  extractedFields: Record<string, string | null> | undefined;
}

export interface ApplyVerificationAuditTrailInput {
  existingAuditTrail: unknown;
  metadata: Record<string, unknown>;
  candidate: VerificationAuditEntryInput;
}

export interface ApplyVerificationAuditTrailResult {
  auditTrail: Record<string, unknown>[];
  appended: boolean;
  skippedDuplicate: boolean;
  duplicateReason: "exact_match" | "ambiguous_replay" | null;
}

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const AMBIGUOUS_REPLAY_WINDOW_MS = 2 * 60 * 1000;
const RECENT_AUDIT_SCAN_LIMIT = 5;

function normalizeAuditTrail(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    : [];
}

function normalizeVerificationAuditEntry(entry: Record<string, unknown>): NormalizedVerificationAuditEntry {
  return {
    action: asString(entry.action),
    by: asString(entry.by),
    at: asString(entry.at),
    atMillis: normalizeTimestamp(entry.at),
    source: asString(entry.source),
    verificationStatus: asString(entry.verificationStatus),
    aiStatus: asString(entry.aiStatus),
    extractedFieldsSignature: asString(entry.extractedFieldsSignature),
  };
}

function buildVerificationAuditEntry(input: VerificationAuditEntryInput): Record<string, unknown> {
  return {
    action: "verified",
    by: input.actor,
    at: input.at,
    source: input.source,
    verificationStatus: input.verificationStatus,
    aiStatus: input.aiStatus,
    extractedFieldsSignature: normalizeExtractedFieldsSignature(input.extractedFields),
  };
}

function buildMetadataFingerprint(metadata: Record<string, unknown>) {
  return {
    verified: metadata.verified === true,
    verificationStatus: asString(metadata.validationStatus) ?? asString(metadata.status),
    aiStatus: asString(metadata.aiStatus),
    extractedFieldsSignature: normalizeExtractedFieldsSignature(metadata.extractedFields),
  };
}

function isSameVerificationState(
  entry: NormalizedVerificationAuditEntry,
  candidate: NormalizedVerificationAuditEntry,
): boolean {
  return (
    entry.action === "verified" &&
    entry.verificationStatus === candidate.verificationStatus &&
    entry.aiStatus === candidate.aiStatus &&
    entry.extractedFieldsSignature === candidate.extractedFieldsSignature
  );
}

export function applyVerificationAuditTrail(
  input: ApplyVerificationAuditTrailInput,
): ApplyVerificationAuditTrailResult {
  const normalizedTrail = normalizeAuditTrail(input.existingAuditTrail);
  const nextEntry = buildVerificationAuditEntry(input.candidate);
  const normalizedCandidate = normalizeVerificationAuditEntry(nextEntry);
  const metadataFingerprint = buildMetadataFingerprint(input.metadata);
  const recentEntries = normalizedTrail
    .slice(-RECENT_AUDIT_SCAN_LIMIT)
    .map((entry) => normalizeVerificationAuditEntry(entry));
  const candidateAtMillis = normalizedCandidate.atMillis;

  for (let index = recentEntries.length - 1; index >= 0; index -= 1) {
    const recentEntry = recentEntries[index];
    if (!isSameVerificationState(recentEntry, normalizedCandidate)) {
      continue;
    }

    const sameActor = recentEntry.by === normalizedCandidate.by;
    const sameSource = recentEntry.source === normalizedCandidate.source || recentEntry.source === null;
    const timestampDelta =
      recentEntry.atMillis !== null && candidateAtMillis !== null
        ? Math.abs(candidateAtMillis - recentEntry.atMillis)
        : null;
    const metadataMatchesCandidate =
      metadataFingerprint.verified &&
      metadataFingerprint.verificationStatus === normalizedCandidate.verificationStatus &&
      metadataFingerprint.aiStatus === normalizedCandidate.aiStatus &&
      metadataFingerprint.extractedFieldsSignature === normalizedCandidate.extractedFieldsSignature;

    if (sameActor && sameSource && (timestampDelta === null || timestampDelta <= DUPLICATE_WINDOW_MS || metadataMatchesCandidate)) {
      return {
        auditTrail: normalizedTrail,
        appended: false,
        skippedDuplicate: true,
        duplicateReason: "exact_match",
      };
    }

    if (timestampDelta !== null && timestampDelta <= AMBIGUOUS_REPLAY_WINDOW_MS) {
      return {
        auditTrail: normalizedTrail,
        appended: false,
        skippedDuplicate: true,
        duplicateReason: "ambiguous_replay",
      };
    }
  }

  return {
    auditTrail: [...normalizedTrail, nextEntry],
    appended: true,
    skippedDuplicate: false,
    duplicateReason: null,
  };
}
