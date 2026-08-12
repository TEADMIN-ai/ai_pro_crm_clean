import { createHash } from "crypto";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildContractorRepositoryDecision, getContractorRepositoryStatusLabel, validateCsdSupplierNumber } from "@/lib/contractors/contractorRepositoryDecision";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { createProvidedPinRecord, recordSarsVerificationResult, sanitizeSarsTcsWritePayload, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import { assertStagingSimulationAllowed, STAGING_SIMULATION_AUTHORITY, STAGING_SIMULATION_MESSAGE, STAGING_SIMULATION_SOURCE } from "@/lib/server/stagingSimulationSafety";
import type { AuthorizedUser } from "@/lib/server/authz";
import { listContractorDocuments } from "@/server/services/contractorService";

type AnyRecord = Record<string, unknown>;
const SIMULATION_REASON = "Controlled TEOS staging end-to-end validation";
const TEST_CSD_NUMBER = "MAAA9999999";
const TEST_TCS_PIN = "STAGINGPIN1234";
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const parsed = value.toMillis();
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function actorName(actor: AuthorizedUser): string { return actor.email?.trim() || actor.uid; }
function actorEmail(actor: AuthorizedUser): string | null { return actor.email?.trim() || null; }
function fields(contractorId: string, workspaceId: string, actor: AuthorizedUser, now: string) {
  return { simulation: true, simulationEnvironment: "staging", verificationSource: STAGING_SIMULATION_SOURCE, evidenceAuthority: STAGING_SIMULATION_AUTHORITY, externalVerificationPerformed: false, usableForProduction: false, testOnly: true, contractorId, workspaceId, actorUid: actor.uid, actorEmail: actorEmail(actor), createdAt: now, verifiedAt: now, auditReason: SIMULATION_REASON, notice: STAGING_SIMULATION_MESSAGE };
}
async function contractor(contractorId: string): Promise<AnyRecord & { id: string }> {
  const snap = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  if (!snap.exists) throw new Error("Contractor not found");
  return { id: snap.id, ...((snap.data() ?? {}) as AnyRecord) };
}
async function audit(action: string, contractorId: string, workspaceId: string, actor: AuthorizedUser, now: string) {
  await getFirebaseAdmin().collection("auditLogs").add({ action, contractorId, workspaceId, actorUid: actor.uid, actorEmail: actorEmail(actor), actorRole: actor.role, timestamp: now, createdAt: now, simulation: true, testOnly: true, verificationSource: STAGING_SIMULATION_SOURCE, reason: SIMULATION_REASON });
}
async function latestSarsTcsRecord(contractorId: string): Promise<SarsTcsVerificationRecord | null> {
  const snap = await getFirebaseAdmin().collection("contractors").doc(contractorId).collection("sarsTcs").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...((doc.data() ?? {}) as AnyRecord) }) as SarsTcsVerificationRecord)
    .sort((left, right) => {
      const leftMillis = toMillis(left.updatedAt) ?? toMillis(left.verifiedAt) ?? toMillis(left.createdAt) ?? 0;
      const rightMillis = toMillis(right.updatedAt) ?? toMillis(right.verifiedAt) ?? toMillis(right.createdAt) ?? 0;
      return rightMillis - leftMillis;
    })[0] ?? null;
}

export async function recomputeCanonicalDecisionAfterStagingSimulation(contractorId: string) {
  const db = getFirebaseAdmin();
  const summary = await recalculateContractorCompliance(db, contractorId);
  const [freshContractor, documents, sarsRecord] = await Promise.all([
    contractor(contractorId),
    listContractorDocuments(contractorId),
    latestSarsTcsRecord(contractorId),
  ]);
  const evaluatedAt = new Date().toISOString();
  const decision = buildContractorRepositoryDecision({
    contractor: { ...freshContractor, sarsTcsSummary: sarsRecord ?? freshContractor.sarsTcsSummary ?? null },
    documents,
    evaluatedAt,
    allowStagingSimulation: true,
  });

  await db.collection("contractors").doc(contractorId).set(
    {
      readinessScore: decision.readinessScore ?? summary.readinessScore,
      readinessStatus: decision.readinessDecisionStatus,
      readinessDecisionStatus: decision.readinessDecisionStatus,
      complianceStatus: decision.complianceDecisionStatus,
      complianceDecisionStatus: decision.complianceDecisionStatus,
      documentReviewStatus: decision.documentReviewStatus,
      externalVerificationStatus: decision.externalVerificationStatus,
      identityMatchStatus: decision.identityMatchStatus,
      identityStatus: decision.identityStatus,
      overallStatus: getContractorRepositoryStatusLabel(decision),
      decisionEvaluatedAt: evaluatedAt,
      readinessUpdatedAt: evaluatedAt,
      decisionLogicVersion: decision.logicVersion,
      logicVersion: decision.logicVersion,
      updatedAt: evaluatedAt,
    },
    { merge: true },
  );

  return { summary, decision, decisionEvaluatedAt: evaluatedAt };
}

export async function simulateStagingCsdVerification(input: { contractorId: string; actor: AuthorizedUser }) {
  assertStagingSimulationAllowed();
  if (validateCsdSupplierNumber(TEST_CSD_NUMBER) !== "VALID") throw new Error("Configured staging CSD number is invalid");
  const c = await contractor(input.contractorId);
  const workspaceId = str(c.workspaceId) ?? "workspace-a";
  const now = new Date().toISOString();
  const documentId = "staging-csd-simulation";
  const document = { id: documentId, documentId, documentType: "csd", docType: "csd", fileName: "STAGING_ONLY_CSD_SIMULATION.txt", status: "verified", currentStatus: "current", verified: true, verificationStatus: "VERIFIED_MANUAL", validationStatus: "PASS", ...fields(input.contractorId, workspaceId, input.actor, now) };
  await getFirebaseAdmin().collection("contractors").doc(input.contractorId).collection("documents").doc(documentId).set(document, { merge: false });
  await getFirebaseAdmin().collection("contractors").doc(input.contractorId).set({ csdNumber: TEST_CSD_NUMBER, csdMNumber: TEST_CSD_NUMBER, csdValidationStatus: "VALID", csdStatus: "Verified/Test", updatedAt: now, stagingCsdSimulation: fields(input.contractorId, workspaceId, input.actor, now) }, { merge: true });
  await audit("STAGING_CSD_SIMULATION", input.contractorId, workspaceId, input.actor, now);
  const recompute = await recomputeCanonicalDecisionAfterStagingSimulation(input.contractorId);
  return { ok: true, document, csdNumber: TEST_CSD_NUMBER, message: STAGING_SIMULATION_MESSAGE, recompute };
}

export async function simulateStagingSarsTcsVerification(input: { contractorId: string; actor: AuthorizedUser }) {
  assertStagingSimulationAllowed();
  const c = await contractor(input.contractorId);
  const workspaceId = str(c.workspaceId) ?? "workspace-a";
  const now = new Date().toISOString();
  const taxpayerName = str(c.companyName) ?? "Torque Empire STAGING TEST Contractor";
  const evidenceDocumentId = "staging-sars-tcs-simulation-evidence";
  const evidenceHash = createHash("sha256").update(`${input.contractorId}:${now}:staging-sars-simulation`).digest("hex");
  const provided = createProvidedPinRecord({ workspaceId, contractorId: input.contractorId, taxReferenceNumber: "9999999999", registeredTaxpayerName: taxpayerName, tcsPin: TEST_TCS_PIN, actorUid: input.actor.uid, actorName: actorName(input.actor), consentConfirmed: true, consentEvidenceId: evidenceDocumentId });
  const verified = recordSarsVerificationResult({ current: provided, status: "VERIFIED_COMPLIANT", source: STAGING_SIMULATION_SOURCE as SarsTcsVerificationRecord["source"], verifiedAt: now, verifiedByUid: input.actor.uid, verifiedByName: actorName(input.actor), taxpayerNameMatch: "MATCH", taxReferenceMatch: "MATCH", registrationNumberMatch: "MATCH", contractorIdentityMatch: "MATCH", mismatchReasons: [], verificationReference: "STAGING_SIMULATION_ONLY", notes: STAGING_SIMULATION_MESSAGE, evidence: { documentId: evidenceDocumentId, hash: evidenceHash, storagePath: `contractors/${input.contractorId}/staging-sars-tcs-simulation`, fileName: "STAGING_ONLY_SARS_TCS_SIMULATION.txt", uploadedAt: now } });
  const record = sanitizeSarsTcsWritePayload({ ...verified, ...fields(input.contractorId, workspaceId, input.actor, now), pinStatus: "ACTIVE" });
  await getFirebaseAdmin().collection("contractors").doc(input.contractorId).collection("sarsTcs").doc(record.id).set(record, { merge: false });
  await getFirebaseAdmin().collection("contractors").doc(input.contractorId).collection("sarsTcsVerifications").doc(record.id).set(record, { merge: false });
  await getFirebaseAdmin().collection("contractors").doc(input.contractorId).set({ sarsTcsCurrentVerificationId: record.id, sarsTcsSummary: record, taxpayerName, taxReferenceNumber: "9999999999", updatedAt: now }, { merge: true });
  await audit("STAGING_SARS_TCS_SIMULATION", input.contractorId, workspaceId, input.actor, now);
  const recompute = await recomputeCanonicalDecisionAfterStagingSimulation(input.contractorId);
  return { ok: true, record, message: STAGING_SIMULATION_MESSAGE, recompute };
}

export const STAGING_SIMULATION_TEST_VALUES = { TEST_CSD_NUMBER, TEST_TCS_PIN, SIMULATION_REASON } as const;




