import fs from "node:fs";
import path from "node:path";

import {
  ContractorBusinessIdentityEvidenceError,
  prepareVerifiedContractorBusinessIdentityEvidence,
  resolveSafeEvidenceOutputPath,
  writeBusinessIdentityEvidenceIdempotently,
  TORQUE_EMPIRE_CONTRACTOR_ID,
  TORQUE_EMPIRE_CONTRACTOR_NAME,
  TORQUE_EMPIRE_PRIMARY_SHA256,
  TORQUE_EMPIRE_SUPPORTING_SHA256,
  TORQUE_EMPIRE_REGISTRATION_NUMBER,
} from "@/lib/contractors/contractorBusinessIdentityEvidence";

const cwd = process.cwd();
const primary = path.join(cwd, "evidence", "contractors", TORQUE_EMPIRE_CONTRACTOR_ID, "torque-empire-cipc-cor14-3.pdf");
const supporting = path.join(cwd, "evidence", "contractors", TORQUE_EMPIRE_CONTRACTOR_ID, "torque-empire-cipc-bbbee-2025.pdf");

function input(overrides: Record<string, unknown> = {}) {
  return { cwd, contractorDocumentId: TORQUE_EMPIRE_CONTRACTOR_ID, expectedContractorName: TORQUE_EMPIRE_CONTRACTOR_NAME, primaryEvidencePath: primary, supportingEvidencePath: supporting, expectedRegistrationNumber: TORQUE_EMPIRE_REGISTRATION_NUMBER, expectedPrimarySHA256: TORQUE_EMPIRE_PRIMARY_SHA256, expectedSupportingSHA256: TORQUE_EMPIRE_SUPPORTING_SHA256, outputPath: "reports/contractors/test-verified-evidence.json", evidenceCollector: "Chadwin Wesley Karanie", ...overrides } as any;
}

test("accepts exact Torque Empire CIPC evidence", async () => {
  const result = await prepareVerifiedContractorBusinessIdentityEvidence(input());
  expect(result.legalBusinessName).toBe("TORQUE EMPIRE (PTY) LTD");
  expect(result.companyRegistrationNumber).toBe(TORQUE_EMPIRE_REGISTRATION_NUMBER);
  expect(result.verificationStatus).toBe("VERIFIED");
  expect(result.contractorIsolationStatus).toBe("VERIFIED");
});

test.each([
  ["another contractor ID", { contractorDocumentId: "other" }, "CONTRACTOR_NOT_ALLOWLISTED"],
  ["another contractor evidence folder", { primaryEvidencePath: path.join(cwd, "evidence", "contractors", "other", "a.pdf") }, "CONTRACTOR_EVIDENCE_PATH_INVALID"],
  ["registration mismatch", { expectedRegistrationNumber: "2024/000000/00" }, "REGISTRATION_EXPECTATION_INVALID"],
  ["expected hash mismatch", { expectedPrimarySHA256: "0".repeat(64) }, "PRIMARY_HASH_MISMATCH"],
] as const)("rejects %s", async (_label, overrides, code) => {
  await expect(prepareVerifiedContractorBusinessIdentityEvidence(input(overrides))).rejects.toMatchObject({ code });
});

test("rejects output traversal and outside paths", () => {
  expect(() => resolveSafeEvidenceOutputPath("../outside.json", cwd)).toThrow(ContractorBusinessIdentityEvidenceError);
  expect(() => resolveSafeEvidenceOutputPath(path.resolve(cwd, "src", "bad.json"), cwd)).toThrow(ContractorBusinessIdentityEvidenceError);
});

test("rejects unsupported output and source types", async () => {
  expect(() => resolveSafeEvidenceOutputPath("reports/contractors/evidence.txt", cwd)).toThrow(ContractorBusinessIdentityEvidenceError);
  await expect(prepareVerifiedContractorBusinessIdentityEvidence(input({ primaryEvidencePath: path.join(cwd, "package.json") }))).rejects.toMatchObject({ code: "CONTRACTOR_EVIDENCE_PATH_INVALID" });
});

test("hashes both sources and excludes sensitive fields and decision mutation", async () => {
  const result = await prepareVerifiedContractorBusinessIdentityEvidence(input());
  expect(result.primarySourceDocumentSHA256).toBe(TORQUE_EMPIRE_PRIMARY_SHA256);
  expect(result.supportingSourceDocumentSHA256).toBe(TORQUE_EMPIRE_SUPPORTING_SHA256);
  const serialized = JSON.stringify(result);
  expect(serialized).not.toMatch(/9006125081081|9108240083081|9962522182|33 BARBERRY|@/i);
  expect(result.redactionSummary.rawPdfTextStored).toBe(false);
  expect(result.controls).toMatchObject({ csdStatus: "INVALID_OR_UNRESOLVED", identityResolutionOccurred: false, readinessChanged: false, complianceChanged: false, assignmentAuthorityChanged: false, assignmentAllowed: false, contractorReferenceIssued: false });
});

test("identical output is idempotent and different content is not overwritten", () => {
  const file = path.join(cwd, "reports", "contractors", "test-idempotent-evidence.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  expect(writeBusinessIdentityEvidenceIdempotently(file, "same")).toBe("created");
  expect(writeBusinessIdentityEvidenceIdempotently(file, "same")).toBe("existing_identical");
  expect(() => writeBusinessIdentityEvidenceIdempotently(file, "different")).toThrow(/different evidence artifact/);
  fs.rmSync(file, { force: true });
});
