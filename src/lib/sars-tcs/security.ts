import { createHash, randomUUID } from "crypto";
import type { SarsTcsAuditEntry, SarsTcsProjection, SarsTcsPublicView, SarsTcsRecheckPolicy, SarsTcsRiskFlag, SarsTcsVerificationRecord } from "./types";
import { DEFAULT_SARS_TCS_RECHECK_POLICY } from "./types";
const PIN_PATTERN = /\b[A-Z0-9]{6,16}\b/g;
function iso(value: Date): string { return value.toISOString(); }
export function normalizeTcsPin(value: unknown): string | null { return typeof value === "string" && value.trim().length >= 6 ? value.trim().toUpperCase().replace(/\s+/g, "") : null; }
export function pinLastFour(pin: string | null): string | null { return pin ? pin.slice(-4) : null; }
export function maskTcsPin(lastFour: string | null): string { return lastFour ? `******${lastFour}` : "Not provided"; }
export function protectTcsPin(pin: string): { encryptedTcsPin: string; protectedSecretRef: string } {
  const digest = createHash("sha256").update("sars-tcs:" + pin).digest("hex");
  return { encryptedTcsPin: "protected:" + digest, protectedSecretRef: "sars-tcs-pin:" + digest.slice(0, 24) };
}
export function redactTcsSecrets(value: string): string {
  return value.replace(PIN_PATTERN, (token) => (/\d/.test(token) ? "[TCS_PIN_REDACTED:" + token.slice(-4) + "]" : token));
}
export function sanitizeAuditTrail(entries: SarsTcsAuditEntry[] = []): SarsTcsAuditEntry[] {
  return entries.map((entry) => ({ ...entry, message: redactTcsSecrets(entry.message), metadata: entry.metadata ? { ...entry.metadata, pin: undefined, tcsPin: undefined, encryptedTcsPin: undefined } : undefined }));
}
function audit(type: string, message: string, actorUid: string | null, actorName: string | null, previousStatus: SarsTcsVerificationRecord["verificationStatus"] | null, newStatus: SarsTcsVerificationRecord["verificationStatus"] | null): SarsTcsAuditEntry {
  return { id: randomUUID(), type, message: redactTcsSecrets(message), actorUid, actorName, createdAt: iso(new Date()), previousStatus, newStatus };
}
export function sanitizeSarsTcsRecord(record: SarsTcsVerificationRecord | null): SarsTcsPublicView | null {
  if (!record) return null;
  const { encryptedTcsPin: _encryptedTcsPin, protectedSecretRef: _protectedSecretRef, auditTrail, ...rest } = record;
  return { ...rest, pinMasked: maskTcsPin(record.pinLastFour), hasProtectedPin: Boolean(record.encryptedTcsPin || record.protectedSecretRef), auditTrail: sanitizeAuditTrail(auditTrail) };
}
export function createProvidedPinRecord(input: { workspaceId: string; contractorId: string; opportunityId?: string | null; taxReferenceNumber: string; registeredTaxpayerName: string; registrationNumber?: string | null; tcsPin: string; actorUid: string; actorName: string; consentConfirmed: boolean; consentEvidenceId?: string | null; previous?: SarsTcsVerificationRecord | null }): SarsTcsVerificationRecord {
  const pin = normalizeTcsPin(input.tcsPin);
  if (!pin) throw new Error("A valid TCS PIN is required");
  if (!input.consentConfirmed) throw new Error("Contractor consent is required before storing a protected TCS PIN reference");
  const now = iso(new Date());
  const protectedPin = protectTcsPin(pin);
  const id = randomUUID();
  return { id, workspaceId: input.workspaceId, contractorId: input.contractorId, opportunityId: input.opportunityId ?? null, taxReferenceNumber: input.taxReferenceNumber, registeredTaxpayerName: input.registeredTaxpayerName, registrationNumber: input.registrationNumber ?? null, encryptedTcsPin: protectedPin.encryptedTcsPin, protectedSecretRef: protectedPin.protectedSecretRef, pinLastFour: pinLastFour(pin), pinStatus: "PROVIDED", pinProvidedAt: now, pinProvidedBy: input.actorUid, consentConfirmed: true, consentConfirmedAt: now, consentEvidenceId: input.consentEvidenceId ?? null, verificationStatus: "PENDING", source: null, verifiedAt: null, verifiedByUid: null, verifiedByName: null, verificationReference: null, resultCapturedAt: null, recheckDueAt: null, notes: null, taxpayerNameMatch: "NOT_CHECKED", taxReferenceMatch: "NOT_CHECKED", registrationNumberMatch: input.registrationNumber ? "NOT_CHECKED" : "NOT_APPLICABLE", contractorIdentityMatch: "NOT_CHECKED", mismatchReasons: [], createdAt: now, updatedAt: now, createdBy: input.actorUid, supersededBy: null, version: (input.previous?.version ?? 0) + 1, auditTrail: [audit("PIN_PROVIDED", "TCS PIN provided and protected for SARS verification", input.actorUid, input.actorName, input.previous?.verificationStatus ?? null, "PENDING")] };
}
export function recordSarsVerificationResult(input: {
  current: SarsTcsVerificationRecord;
  status: SarsTcsVerificationRecord["verificationStatus"];
  source: SarsTcsVerificationRecord["source"];
  verifiedAt: string;
  verifiedByUid: string;
  verifiedByName: string;
  taxpayerNameMatch: SarsTcsVerificationRecord["taxpayerNameMatch"];
  taxReferenceMatch: SarsTcsVerificationRecord["taxReferenceMatch"];
  registrationNumberMatch?: SarsTcsVerificationRecord["registrationNumberMatch"];
  contractorIdentityMatch: SarsTcsVerificationRecord["contractorIdentityMatch"];
  mismatchReasons?: string[];
  verificationReference?: string | null;
  notes?: string | null;
  evidence?: { documentId?: string | null; hash?: string | null; storagePath?: string | null; fileName?: string | null; uploadedAt?: string | null };
  policy?: SarsTcsRecheckPolicy;
}): SarsTcsVerificationRecord {
  if (input.current.lockedAt) throw new Error("SARS verification records are immutable after submission; create a superseding record");
  if (input.status === "VERIFIED_COMPLIANT" && (input.taxpayerNameMatch !== "MATCH" || input.taxReferenceMatch !== "MATCH" || input.contractorIdentityMatch !== "MATCH")) throw new Error("Compliant verification requires identity and tax reference matches");
  const now = iso(new Date());
  const policy = input.policy ?? DEFAULT_SARS_TCS_RECHECK_POLICY;
  const due = new Date(input.verifiedAt);
  due.setUTCDate(due.getUTCDate() + policy.maxAgeDays);
  const pinStatus = input.status === "INVALID_PIN" ? "INVALID" : input.status === "EXPIRED" ? "EXPIRED" : input.current.pinStatus === "PROVIDED" ? "ACTIVE" : input.current.pinStatus;
  return {
    ...input.current,
    pinStatus,
    verificationStatus: input.status,
    source: input.source,
    verifiedAt: input.verifiedAt,
    verifiedByUid: input.verifiedByUid,
    verifiedByName: input.verifiedByName,
    verificationReference: input.verificationReference ?? null,
    resultCapturedAt: now,
    recheckDueAt: due.toISOString(),
    notes: input.notes ? redactTcsSecrets(input.notes) : null,
    taxpayerNameMatch: input.taxpayerNameMatch,
    taxReferenceMatch: input.taxReferenceMatch,
    registrationNumberMatch: input.registrationNumberMatch ?? input.current.registrationNumberMatch,
    contractorIdentityMatch: input.contractorIdentityMatch,
    mismatchReasons: input.mismatchReasons ?? [],
    verificationEvidenceDocumentId: input.evidence?.documentId ?? input.current.verificationEvidenceDocumentId ?? null,
    verificationEvidenceHash: input.evidence?.hash ?? input.current.verificationEvidenceHash ?? null,
    evidenceStoragePath: input.evidence?.storagePath ?? input.current.evidenceStoragePath ?? null,
    evidenceFileName: input.evidence?.fileName ?? input.current.evidenceFileName ?? null,
    evidenceUploadedAt: input.evidence?.uploadedAt ?? input.current.evidenceUploadedAt ?? null,
    updatedAt: now,
    lockedAt: now,
    auditTrail: [
      ...sanitizeAuditTrail(input.current.auditTrail),
      audit("SARS_RESULT_RECORDED", "SARS TCS verification result recorded", input.verifiedByUid, input.verifiedByName, input.current.verificationStatus, input.status),
    ],
  };
}
function isStale(record: SarsTcsVerificationRecord | null, now = new Date()): boolean {
  if (!record?.recheckDueAt) return false;
  return Date.parse(record.recheckDueAt) <= now.getTime();
}
function hasMismatch(record: SarsTcsVerificationRecord | null): boolean {
  return Boolean(record && (record.taxpayerNameMatch === "MISMATCH" || record.taxReferenceMatch === "MISMATCH" || record.registrationNumberMatch === "MISMATCH" || record.contractorIdentityMatch === "MISMATCH"));
}
export function buildSarsTcsProjection(input: { record?: SarsTcsVerificationRecord | null; taxDocumentStatus?: string | null; route?: string | null; requiresLiveVerification?: boolean; policy?: SarsTcsRecheckPolicy; now?: Date }): SarsTcsProjection {
  const record = input.record ?? null;
  const route = input.route ?? (record?.contractorId ? "/dashboard/contractors/" + encodeURIComponent(record.contractorId) : null);
  const stale = isStale(record, input.now ?? new Date());
  const requiresLiveVerification = input.requiresLiveVerification === true;
  const mismatch = hasMismatch(record) || record?.verificationStatus === 'DETAILS_MISMATCH';
  const requiredBlockers: string[] = [];
  const adverseBlockers: string[] = [];
  const flags: SarsTcsRiskFlag[] = [];
  if (!record || record.pinStatus === 'NOT_PROVIDED') requiredBlockers.push('Active SARS TCS PIN is missing');
  if (record?.verificationStatus === 'PENDING' || record?.verificationStatus === 'NOT_STARTED') requiredBlockers.push('SARS TCS PIN has not been verified live');
  if (record?.verificationStatus === 'REVIEW_REQUIRED') requiredBlockers.push('SARS TCS verification requires review');
  if (record?.verificationStatus === 'INVALID_PIN' || record?.pinStatus === 'INVALID') { adverseBlockers.push('SARS TCS PIN is invalid'); flags.push('INVALID_TCS_PIN'); }
  if (record?.pinStatus === 'EXPIRED' || record?.verificationStatus === 'EXPIRED') { requiredBlockers.push('SARS TCS PIN or verification is expired'); flags.push('EXPIRED_TCS_PIN'); }
  if (record?.pinStatus === 'CANCELLED') { adverseBlockers.push('SARS TCS PIN is cancelled'); flags.push('CANCELLED_TCS_PIN'); }
  if (record?.verificationStatus === 'VERIFIED_NON_COMPLIANT') { adverseBlockers.push('Live SARS status is non-compliant'); flags.push('NON_COMPLIANT_TAX_STATUS'); }
  if (mismatch) { adverseBlockers.push('SARS taxpayer details do not match contractor identity'); flags.push('CONTRACTOR_IDENTITY_MISMATCH'); }
  if (record?.taxpayerNameMatch === "MISMATCH") flags.push("TAXPAYER_NAME_MISMATCH");
  if (record?.taxReferenceMatch === "MISMATCH") flags.push("TAX_REFERENCE_MISMATCH");
  if (record?.registrationNumberMatch === "MISMATCH") flags.push("REGISTRATION_NUMBER_MISMATCH");
  if (stale) { requiredBlockers.push('SARS TCS verification is stale and must be rechecked'); flags.push('STALE_TCS_VERIFICATION'); }
  if (record?.verificationStatus === "VERIFIED_COMPLIANT" && !record.verificationEvidenceDocumentId && !record.verificationEvidenceHash) flags.push("EVIDENCE_MISSING");
  const blockers = requiresLiveVerification ? [...requiredBlockers, ...adverseBlockers] : adverseBlockers;
  const next = !record || record.pinStatus === "NOT_PROVIDED" ? "REQUEST_TCS_PIN" : record.verificationStatus === "INVALID_PIN" || record.pinStatus === "INVALID" ? "REQUEST_TCS_PIN" : record.verificationStatus === "EXPIRED" || record.pinStatus === "EXPIRED" || record.pinStatus === "CANCELLED" ? "REQUEST_TCS_PIN" : record.verificationStatus === "PENDING" || record.verificationStatus === "NOT_STARTED" ? "VERIFY_TCS_WITH_SARS" : mismatch ? "RESOLVE_TAX_IDENTITY_MISMATCH" : record.verificationStatus === "VERIFIED_NON_COMPLIANT" ? "REQUEST_TAX_REMEDIATION" : stale ? "REVERIFY_TCS" : "TAX_VERIFICATION_COMPLETE";
  return { taxDocumentStatus: input.taxDocumentStatus ?? "unknown", sarsVerificationStatus: record?.verificationStatus ?? "NOT_STARTED", sarsVerifiedAt: record?.verifiedAt ?? null, sarsRecheckDueAt: record?.recheckDueAt ?? null, sarsIdentityMatch: record?.contractorIdentityMatch ?? "NOT_CHECKED", sarsVerificationBlockers: Array.from(new Set(blockers)), sarsVerificationRoute: route, sarsNextAction: next, sarsRiskFlags: Array.from(new Set(flags)), verifiedByName: record?.verifiedByName ?? null, source: record?.source ?? null, evidenceAvailable: Boolean(record?.verificationEvidenceDocumentId || record?.verificationEvidenceHash || record?.evidenceStoragePath) };
}
