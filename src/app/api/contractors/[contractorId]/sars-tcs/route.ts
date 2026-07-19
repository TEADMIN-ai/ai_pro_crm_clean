import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertCanAccessContractor, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { SARS_TCS_SOQS_VERIFY_URL, buildSarsTcsProjection, createProvidedPinRecord, recordSarsVerificationResult, sanitizeSarsTcsRecord, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import { resolveContractorForAccess } from "@/server/services/contractorService";
function jsonError(message: string, status = 500) { return NextResponse.json({ error: message }, { status }); }
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function actorName(user: { email?: string; uid: string }) { return user.email?.trim() || user.uid; }
async function loadLatestRecord(contractorId: string): Promise<SarsTcsVerificationRecord | null> {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).collection("sarsTcsVerifications").orderBy("version", "desc").limit(1).get();
  const first = snapshot.docs[0];
  return first ? ({ id: first.id, ...(first.data() as Record<string, unknown>) } as SarsTcsVerificationRecord) : null;
}
async function saveCurrentRecord(record: SarsTcsVerificationRecord, previous?: SarsTcsVerificationRecord | null, reason = "superseded") {
  const db = getFirebaseAdmin();
  if (previous && previous.id !== record.id) await db.collection("contractors").doc(record.contractorId).collection("sarsTcsVerifications").doc(previous.id).set({ supersededBy: record.id, supersededAt: new Date().toISOString(), supersededReason: reason, updatedAt: new Date().toISOString() }, { merge: true });
  await db.collection("contractors").doc(record.contractorId).collection("sarsTcsVerifications").doc(record.id).set(record, { merge: false });
  await db.collection("contractors").doc(record.contractorId).set({ sarsTcsCurrentVerificationId: record.id, sarsTcsSummary: sanitizeSarsTcsRecord(record), updatedAt: new Date().toISOString() }, { merge: true });
}
export async function GET(request: NextRequest, context: { params: Promise<{ contractorId: string }> }) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;
    const resolved = await resolveContractorForAccess({ contractorReference: contractorId, actor: user, logContext: "api.contractors.sars-tcs" });
    if (resolved.ok === false) return jsonError("Contractor not found", resolved.failureReason === "cross_workspace" || resolved.failureReason === "unauthorized_contractor" ? 403 : 404);
    assertCanAccessContractor(user, resolved.contractorId);
    const record = await loadLatestRecord(resolved.contractorId);
    const projection = buildSarsTcsProjection({ record, taxDocumentStatus: str(resolved.contractor.taxPinStatus) ?? "unknown", route: "/dashboard/contractors/" + encodeURIComponent(resolved.contractorId), requiresLiveVerification: true });
    return NextResponse.json({ record: sanitizeSarsTcsRecord(record), projection, officialLinks: { soqs: SARS_TCS_SOQS_VERIFY_URL } });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("SARS TCS fetch failed");
    return jsonError("Failed to load SARS TCS verification", 500);
  }
}
export async function POST(request: NextRequest, context: { params: Promise<{ contractorId: string }> }) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = str(body.action);
    const resolved = await resolveContractorForAccess({ contractorReference: contractorId, actor: user, logContext: "api.contractors.sars-tcs.mutate" });
    if (resolved.ok === false) return jsonError("Contractor not found", resolved.failureReason === "cross_workspace" || resolved.failureReason === "unauthorized_contractor" ? 403 : 404);
    assertCanAccessContractor(user, resolved.contractorId);
    const previous = await loadLatestRecord(resolved.contractorId);
    if (action === "provide_pin") {
      const record = createProvidedPinRecord({ workspaceId: str(resolved.contractor.workspaceId) ?? "default", contractorId: resolved.contractorId, opportunityId: str(body.opportunityId), taxReferenceNumber: str(body.taxReferenceNumber) ?? str(resolved.contractor.taxReferenceNumber) ?? str(resolved.contractor.taxNumber) ?? "", registeredTaxpayerName: str(body.registeredTaxpayerName) ?? str(resolved.contractor.companyName) ?? "", registrationNumber: str(body.registrationNumber) ?? str(resolved.contractor.registrationNumber), tcsPin: String(body.tcsPin ?? ""), actorUid: user.uid, actorName: actorName(user), consentConfirmed: body.consentConfirmed === true, consentEvidenceId: str(body.consentEvidenceId), previous });
      await saveCurrentRecord(record, previous, "PIN replaced or supplied");
      return NextResponse.json({ record: sanitizeSarsTcsRecord(record), projection: buildSarsTcsProjection({ record, route: "/dashboard/contractors/" + encodeURIComponent(resolved.contractorId), requiresLiveVerification: true }) });
    }
    if (!isPrivilegedRole(user.role)) return jsonError("Contractors may provide a PIN but may not mark themselves SARS verified", 403);
    if (!previous) return jsonError("A TCS PIN must be provided before verification can be recorded", 409);
    if (action === "record_verification" || action === "mark_mismatch") {
      const status = action === "mark_mismatch" ? "DETAILS_MISMATCH" : str(body.verificationStatus) ?? "REVIEW_REQUIRED";
      const record = recordSarsVerificationResult({ current: previous, status: status as SarsTcsVerificationRecord["verificationStatus"], source: (str(body.source) ?? "SARS_SOQS") as SarsTcsVerificationRecord["source"], verifiedAt: str(body.verifiedAt) ?? new Date().toISOString(), verifiedByUid: user.uid, verifiedByName: actorName(user), taxpayerNameMatch: (str(body.taxpayerNameMatch) ?? "NOT_CHECKED") as SarsTcsVerificationRecord["taxpayerNameMatch"], taxReferenceMatch: (str(body.taxReferenceMatch) ?? "NOT_CHECKED") as SarsTcsVerificationRecord["taxReferenceMatch"], registrationNumberMatch: (str(body.registrationNumberMatch) ?? previous.registrationNumberMatch) as SarsTcsVerificationRecord["registrationNumberMatch"], contractorIdentityMatch: (str(body.contractorIdentityMatch) ?? "NOT_CHECKED") as SarsTcsVerificationRecord["contractorIdentityMatch"], mismatchReasons: Array.isArray(body.mismatchReasons) ? body.mismatchReasons.filter((item): item is string => typeof item === "string") : [], verificationReference: str(body.verificationReference), notes: str(body.notes), evidence: { documentId: str(body.verificationEvidenceDocumentId), hash: str(body.verificationEvidenceHash), storagePath: str(body.evidenceStoragePath), fileName: str(body.evidenceFileName), uploadedAt: str(body.evidenceUploadedAt) } });
      await saveCurrentRecord(record, null);
      return NextResponse.json({ record: sanitizeSarsTcsRecord(record), projection: buildSarsTcsProjection({ record, route: "/dashboard/contractors/" + encodeURIComponent(resolved.contractorId), requiresLiveVerification: true }) });
    }
    if (action === "request_updated_pin") {
      await getFirebaseAdmin().collection("contractors").doc(resolved.contractorId).collection("sarsTcsRequests").add({ type: "REQUEST_UPDATED_PIN", requestedBy: user.uid, requestedAt: new Date().toISOString(), reason: str(body.reason) ?? "Updated SARS TCS PIN required" });
      return NextResponse.json({ ok: true });
    }
    return jsonError("Unsupported SARS TCS action", 400);
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("SARS TCS mutation failed");
    return jsonError(error instanceof Error ? error.message : "Failed to update SARS TCS verification", 500);
  }
}
