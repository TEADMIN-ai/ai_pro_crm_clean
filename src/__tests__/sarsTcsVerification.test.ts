import { buildProcurementExecutionProjection } from "@/lib/opportunities/procurementExecutionProjection";
import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";
import { buildSubmissionReviewView } from "@/lib/submission-review";
import { buildSarsTcsProjection, createProvidedPinRecord, recordSarsVerificationResult, redactTcsSecrets, sanitizeSarsTcsRecord, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";

const fullPin = "AB12345678";
function provided(previous?: SarsTcsVerificationRecord | null) {
  return createProvidedPinRecord({ workspaceId: "workspace-a", contractorId: "contractor-a", taxReferenceNumber: "9876543210", registeredTaxpayerName: "Torque Empire (Pty) Ltd", registrationNumber: "2020/123456/07", tcsPin: fullPin, actorUid: "contractor-uid", actorName: "Contractor", consentConfirmed: true, previous });
}
function verified(status: SarsTcsVerificationRecord["verificationStatus"] = "VERIFIED_COMPLIANT", current = provided()) {
  return recordSarsVerificationResult({ current, status, source: "SARS_SOQS", verifiedAt: "2026-07-01T08:00:00.000Z", verifiedByUid: "staff-uid", verifiedByName: "Staff User", taxpayerNameMatch: status === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", taxReferenceMatch: status === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", registrationNumberMatch: "MATCH", contractorIdentityMatch: status === "DETAILS_MISMATCH" ? "MISMATCH" : "MATCH", mismatchReasons: status === "DETAILS_MISMATCH" ? ["SARS name differs from contractor profile"] : [], verificationReference: "SOQS-1", notes: "Checked against SARS SOQS", evidence: { hash: "sha256:evidence" }, policy: { maxAgeDays: 30, requireBeforeFinalSubmission: true } });
}
describe("SARS TCS verification domain", () => {
  it("protects contractor-provided PINs and masks normal responses", () => {
    const record = provided();
    const view = sanitizeSarsTcsRecord(record);
    expect(record.encryptedTcsPin).toMatch(/^protected:/);
    expect(JSON.stringify(view)).not.toContain(fullPin);
    expect(view?.pinMasked).toBe("******5678");
  });
  it("redacts PIN-looking values from audit and logs", () => {
    const text = redactTcsSecrets(`PIN ${fullPin} was supplied`);
    expect(text).not.toContain(fullPin);
    expect(JSON.stringify(sanitizeSarsTcsRecord(provided())?.auditTrail)).not.toContain(fullPin);
  });
  it("allows staff to record a compliant live verification", () => {
    const projection = buildSarsTcsProjection({ record: verified(), requiresLiveVerification: true, now: new Date("2026-07-10T00:00:00.000Z") });
    expect(projection.sarsVerificationStatus).toBe("VERIFIED_COMPLIANT");
    expect(projection.sarsNextAction).toBe("TAX_VERIFICATION_COMPLETE");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });
  it("blocks non-compliant, invalid PIN, identity mismatch, and stale results", () => {
    expect(buildSarsTcsProjection({ record: verified("VERIFIED_NON_COMPLIANT"), requiresLiveVerification: true }).sarsRiskFlags).toContain("NON_COMPLIANT_TAX_STATUS");
    expect(buildSarsTcsProjection({ record: verified("INVALID_PIN"), requiresLiveVerification: true }).sarsNextAction).toBe("REQUEST_TCS_PIN");
    expect(buildSarsTcsProjection({ record: verified("DETAILS_MISMATCH"), requiresLiveVerification: true }).sarsNextAction).toBe("RESOLVE_TAX_IDENTITY_MISMATCH");
    expect(buildSarsTcsProjection({ record: verified(), requiresLiveVerification: true, now: new Date("2026-08-15T00:00:00.000Z") }).sarsNextAction).toBe("REVERIFY_TCS");
  });
  it("invalidates prior verification when a new PIN is supplied", () => {
    const prior = verified();
    const replacement = provided(prior);
    expect(replacement.version).toBe(prior.version + 1);
    expect(buildSarsTcsProjection({ record: replacement, requiresLiveVerification: true }).sarsNextAction).toBe("VERIFY_TCS_WITH_SARS");
  });
  it("does not treat an uploaded document or screenshot evidence as live verification", () => {
    const missing = buildSarsTcsProjection({ record: null, taxDocumentStatus: "verified", requiresLiveVerification: true });
    expect(missing.sarsNextAction).toBe("REQUEST_TCS_PIN");
    const nonCompliantWithEvidence = verified("VERIFIED_NON_COMPLIANT");
    expect(buildSarsTcsProjection({ record: nonCompliantWithEvidence, requiresLiveVerification: true }).sarsNextAction).toBe("REQUEST_TAX_REMEDIATION");
  });
  it("locks verification records and requires superseding corrections", () => {
    const current = verified();
    expect(current.lockedAt).toBeTruthy();
    expect(() => verified("VERIFIED_COMPLIANT", current)).toThrow("immutable");
  });
});
function dealWithSars(record: SarsTcsVerificationRecord | null) {
  return { id: "deal-a", opportunityId: "opp-a", workspaceId: "workspace-a", contractorId: "contractor-a", contractorName: "Torque Empire (Pty) Ltd", contractorAssignment: { contractorId: "contractor-a", contractorName: "Torque Empire (Pty) Ltd", assignedAt: "2026-07-01T08:00:00.000Z", assignedBy: "staff-uid", assignedByEmail: "staff@example.com", assignmentStatus: "assigned", workspaceId: "workspace-a", executionWorkspaceId: "exec-a" }, closingDate: "2026-08-01T10:00:00.000Z", documents: [], sarsTcsSummary: record, opportunityExecution: { requirementsReviewed: true, complianceReviewed: true, documentsPrepared: true, internalReviewApproved: true, tenderPackGenerated: true, tenderPackValidated: true, requirements: { reviewed: true, taxRequirement: true, bbbeeRequirement: false, coidaRequirement: false, csdRequirement: false, bankingRequirement: false, boqPricingSchedulePresent: false, signatureRequired: false, compulsoryReturnables: ["Tax compliance"], sarsVerificationRequired: true } }, tenderIntelligence: { reviewStatus: "APPROVED", boqClassification: "NO_PRICING_REQUIRED", extractedLineItems: [] }, tenderPricing: { pricingStatus: "LOCKED", pricingApproved: true, pricingDocumentId: "priced" }, submissionReview: { reviewStatus: "APPROVED" }, tenderPack: { packStatus: "VALIDATED" } };
}
const contractor = { id: "contractor-a", contractorId: "contractor-a", companyName: "Torque Empire (Pty) Ltd", workspaceId: "workspace-a", readinessScore: 100, taxValid: true, bbbeeValid: true, coidaValid: true, csdValid: true, bankingValid: true, SBDforms: true };
describe("SARS TCS procurement and submission integration", () => {
  it("adds the canonical SARS result to procurement execution", () => {
    const deal = dealWithSars(verified());
    const state = buildOpportunityExecutionState({ deal, contractor });
    const projection = buildProcurementExecutionProjection({ deal, state, remediationRequests: state.remediationRequests });
    expect(projection.sarsVerificationStatus).toBe("VERIFIED_COMPLIANT");
    expect(projection.sarsNextAction).toBe("TAX_VERIFICATION_COMPLETE");
  });
  it("blocks procurement and submission review when live tax verification is missing", () => {
    const deal = dealWithSars(null);
    const state = buildOpportunityExecutionState({ deal, contractor });
    const projection = buildProcurementExecutionProjection({ deal, state, remediationRequests: state.remediationRequests });
    expect(projection.sarsVerificationBlockers).toContain("Active SARS TCS PIN is missing");
    expect(projection.nextAction.key).toBe("REQUEST_TCS_PIN");
    const review = buildSubmissionReviewView({ review: { id: "deal-a", dealId: "deal-a", contractorId: "contractor-a", workspaceId: "workspace-a" }, deal, contractor });
    expect(review.sarsVerificationStatus).toBe("NOT_STARTED");
    expect(review.sarsVerificationBlockers).toContain("Active SARS TCS PIN is missing");
  });
});
