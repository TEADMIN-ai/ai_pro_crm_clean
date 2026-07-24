import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ALLOWLIST_CONFIRMATION,
  ALLOWLISTED_CONTRACTOR_ID,
  PRODUCTION_CONFIRMATION,
  REVIEWER_CONFIRMATION,
  assertExactIdentityMutationAllowlist,
  computePostApplyIdentityFingerprint,
  prepareContractorIdentityResolutionApplyPlan,
  resolveSafeApplyReportPath,
  writeApplyPlanIdempotently,
  type ContractorIdentityApplyInput,
} from "@/lib/contractors/contractorIdentityResolutionApply";
import { computeContractorIdentitySourceFingerprint } from "@/lib/contractors/contractorIdentityResolution";
import type { ContractorManualIdentityResolutionProposal } from "@/lib/contractors/contractorIdentityResolution";
import { parseContractorIdentityApplyArgs, prepareLocalContractorIdentityApplyPlan } from "../../scripts/applyContractorIdentityResolution";

const cwd = process.cwd();
const proposalPath = path.join(cwd, "reports/contractors/contractor-identity-resolution-proposal-z0yX8cyt38hkfa60UEyNTOiX2812.json");
const snapshotPath = path.join(cwd, "reports/contractors/readonly-production-snapshot-mrk.json");
const auditPath = path.join(cwd, "reports/contractors/contractor-decision-audit-mrk.json");
const evidencePath = path.join(cwd, "reports/contractors/verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json");
const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8")) as ContractorManualIdentityResolutionProposal;
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const auditReport = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const fingerprint = computeContractorIdentitySourceFingerprint({ contractorId: ALLOWLISTED_CONTRACTOR_ID, snapshot, auditReport });

function input(overrides: Record<string, unknown> = {}): ContractorIdentityApplyInput {
  return { contractorId: ALLOWLISTED_CONTRACTOR_ID, proposal, snapshot, auditReport, proposalPath: "reports/contractors/proposal.json", snapshotPath: "reports/contractors/snapshot.json", auditPath: "reports/contractors/audit.json", verifiedBusinessIdentityEvidencePath: proposal.verifiedBusinessIdentityEvidencePath, verifiedBusinessIdentityEvidence: evidence, expectedBeforeStateFingerprint: fingerprint, ...overrides } as ContractorIdentityApplyInput;
}

test("valid bounded dry-run plan is local, protected, and identity-only", () => {
  const plan = prepareContractorIdentityResolutionApplyPlan(input());
  expect(plan.mode).toBe("DRY_RUN_PLAN_ONLY");
  expect(plan.productionExecutionAllowed).toBe(false);
  expect(plan.firebaseReadOccurred).toBe(false);
  expect(plan.firebaseWriteOccurred).toBe(false);
  expect(plan.contractorDocumentPath).toBe(`contractors/${ALLOWLISTED_CONTRACTOR_ID}`);
  expect(plan.protectedDecisions.assignmentAllowed).toBe(false);
  expect(plan.proposedIdentityFields.identityStatus).toBe("MANUALLY_RESOLVED");
  expect(plan.proposedIdentityFields).not.toHaveProperty("readinessStatus");
});

test.each([
  ["another contractor", { contractorId: "other-contractor" }, "CONTRACTOR_NOT_ALLOWLISTED"],
  ["proposal mismatch", { proposal: { ...proposal, contractorDocumentId: "other-contractor" } }, "PROPOSAL_CONTRACTOR_MISMATCH"],
  ["evidence mismatch", { verifiedBusinessIdentityEvidence: { ...evidence, contractorDocumentId: "other-contractor" } }, "EVIDENCE_CONTRACTOR_MISMATCH"],
  ["unverified evidence", { verifiedBusinessIdentityEvidence: { ...evidence, verificationStatus: "PENDING" } }, "EVIDENCE_VERIFICATION_REQUIRED"],
  ["unisolated evidence", { verifiedBusinessIdentityEvidence: { ...evidence, contractorIsolationStatus: "UNVERIFIED" } }, "EVIDENCE_ISOLATION_REQUIRED"],
  ["legal-name mismatch", { verifiedBusinessIdentityEvidence: { ...evidence, legalBusinessName: "Mr K" } }, "EVIDENCE_LEGAL_NAME_MISMATCH"],
  ["registration mismatch", { verifiedBusinessIdentityEvidence: { ...evidence, companyRegistrationNumber: "1" } }, "EVIDENCE_REGISTRATION_MISMATCH"],
  ["source hash mismatch", { verifiedBusinessIdentityEvidence: { ...evidence, primarySourceDocumentSHA256: "bad" } }, "EVIDENCE_PRIMARY_HASH_MISMATCH"],
  ["missing evidence path", { verifiedBusinessIdentityEvidencePath: "reports/contractors/other.json" }, "EVIDENCE_PATH_MISMATCH"],
  ["stale fingerprint", { expectedBeforeStateFingerprint: "stale" }, "EXPECTED_FINGERPRINT_PROPOSAL_MISMATCH"],
  ["already resolved", { proposal: { ...proposal, beforeState: { ...proposal.beforeState, identityResolved: true } } }, "IDENTITY_ALREADY_RESOLVED"],
  ["reference issued", { proposal: { ...proposal, beforeState: { ...proposal.beforeState, canonicalContractorFacingReference: { status: "ISSUED", value: "TE-001" } } } }, "REFERENCE_ALREADY_ISSUED"],
])("rejects %s", (_label, overrides, code) => {
  expect(() => prepareContractorIdentityResolutionApplyPlan(input(overrides))).toThrow(expect.objectContaining({ code }));
});

test.each(["readinessStatus", "complianceStatus", "assignmentAllowed", "csdNumber", "canonicalContractorFacingReference", "userId", "workspaceId", "dealId"])("rejects forbidden or unexpected field %s", (field) => {
  expect(() => assertExactIdentityMutationAllowlist({ [field]: true })).toThrow();
});

test("post-apply fingerprint is deterministic and rollback is identity-only", () => {
  const plan = prepareContractorIdentityResolutionApplyPlan(input());
  expect(computePostApplyIdentityFingerprint(plan.proposedIdentityFields)).toBe(plan.proposedIdentityFields.postStateFingerprint);
  expect(plan.rollbackPlan.restoresOnlyAllowedIdentityFields).toBe(true);
  expect(plan.rollbackPlan.refusesUnexpectedPostApplyFingerprint).toBe(true);
});

test("safe report path rejects traversal and accepts reports/contractors", () => {
  expect(() => resolveSafeApplyReportPath("../outside.json")).toThrow();
  expect(() => resolveSafeApplyReportPath("reports/contractors/%2e%2e/outside.json")).toThrow();
  expect(() => resolveSafeApplyReportPath("reports/contractors/plan.txt")).toThrow();
  expect(resolveSafeApplyReportPath("reports/contractors/plan.json")).toBe(path.join(cwd, "reports/contractors/plan.json"));
});

test("apply confirmation values are explicit and not implied by dry-run", () => {
  expect(PRODUCTION_CONFIRMATION).toContain(ALLOWLISTED_CONTRACTOR_ID);
  expect(ALLOWLIST_CONFIRMATION).toContain(ALLOWLISTED_CONTRACTOR_ID);
  expect(REVIEWER_CONFIRMATION).toContain("CHADWIN");
  expect(parseContractorIdentityApplyArgs(["--apply"]).apply).toBe(true);
});

test("plan output is idempotent and does not overwrite different content", () => {
  const output = path.join(cwd, "reports/contractors", `.apply-test-${crypto.randomUUID()}.json`);
  try {
    const plan = prepareContractorIdentityResolutionApplyPlan(input());
    expect(writeApplyPlanIdempotently(output, plan)).toBe("created");
    expect(writeApplyPlanIdempotently(output, plan)).toBe("existing_identical");
    fs.writeFileSync(output, "different", "utf8");
    expect(() => writeApplyPlanIdempotently(output, plan)).toThrow(/overwrite/);
  } finally { fs.rmSync(output, { force: true }); }
});




