import { readFileSync } from "node:fs";
import path from "node:path";
import { buildContractorRepositoryDecision, validateCsdSupplierNumber } from "@/lib/contractors/contractorRepositoryDecision";
import { buildSarsTcsProjection, protectTcsPin, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import { STAGING_SIMULATION_MESSAGE, STAGING_SIMULATION_SOURCE } from "@/lib/server/stagingSimulationSafety";
import type { ContractorDocument } from "@/types/document";

function simulatedSarsRecord(): SarsTcsVerificationRecord {
  const protectedPin = protectTcsPin("STAGINGPIN1234");
  return { id: "sars-sim", workspaceId: "workspace-a", contractorId: "rwBxCeiW77cvEbUDY6BjFt2FmzI2", taxReferenceNumber: "9999999999", registeredTaxpayerName: "Torque Empire STAGING TEST Contractor", ...protectedPin, pinLastFour: "1234", pinStatus: "ACTIVE", pinProvidedAt: "2026-08-12T08:00:00.000Z", pinProvidedBy: "staff-1", consentConfirmed: true, consentConfirmedAt: "2026-08-12T08:00:00.000Z", verificationStatus: "VERIFIED_COMPLIANT", source: STAGING_SIMULATION_SOURCE, verifiedAt: "2026-08-12T08:00:00.000Z", verifiedByUid: "staff-1", verifiedByName: "staff@example.com", verificationReference: "STAGING_SIMULATION_ONLY", resultCapturedAt: "2026-08-12T08:00:00.000Z", recheckDueAt: "2026-09-12T08:00:00.000Z", notes: STAGING_SIMULATION_MESSAGE, taxpayerNameMatch: "MATCH", taxReferenceMatch: "MATCH", registrationNumberMatch: "MATCH", contractorIdentityMatch: "MATCH", mismatchReasons: [], verificationEvidenceDocumentId: "staging-sars-tcs-simulation-evidence", verificationEvidenceHash: "hash", evidenceStoragePath: "contractors/test/staging-sars-tcs-simulation", evidenceFileName: "STAGING_ONLY_SARS_TCS_SIMULATION.txt", evidenceUploadedAt: "2026-08-12T08:00:00.000Z", createdAt: "2026-08-12T08:00:00.000Z", updatedAt: "2026-08-12T08:00:00.000Z", createdBy: "staff-1", version: 1, auditTrail: [], simulation: true, testOnly: true, externalVerificationPerformed: false, usableForProduction: false, verificationSource: STAGING_SIMULATION_SOURCE } as SarsTcsVerificationRecord;
}

describe("staging verification simulation schemas", () => {
  test("staging CSD test number validates", () => {
    expect(validateCsdSupplierNumber("MAAA9999999")).toBe("VALID");
  });
  test("simulated SARS record is test-only with matching identity, protected PIN, evidence, and no external verification", () => {
    const record = simulatedSarsRecord() as SarsTcsVerificationRecord & { simulation: boolean; testOnly: boolean; externalVerificationPerformed: boolean; usableForProduction: boolean; verificationSource: string };
    const projection = buildSarsTcsProjection({ record, requiresLiveVerification: true, allowStagingSimulation: true });
    expect(record.simulation).toBe(true);
    expect(record.testOnly).toBe(true);
    expect(record.externalVerificationPerformed).toBe(false);
    expect(record.usableForProduction).toBe(false);
    expect(record.verificationSource).toBe(STAGING_SIMULATION_SOURCE);
    expect(record.contractorIdentityMatch).toBe("MATCH");
    expect(record.pinStatus).toBe("ACTIVE");
    expect(record.encryptedTcsPin).toMatch(/^protected:/);
    expect(projection.evidenceAvailable).toBe(true);
  });
  test("simulated SARS record is rejected as production evidence unless staging simulation is explicitly allowed", () => {
    const projection = buildSarsTcsProjection({ record: simulatedSarsRecord(), requiresLiveVerification: true });
    expect(projection.evidenceAvailable).toBe(false);
    expect(projection.sarsVerificationBlockers).toContain("Simulated staging SARS TCS evidence is not valid outside verified staging");
  });
});

test("normal SARS route rejects client-supplied simulation source", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/api/contractors/[contractorId]/sars-tcs/route.ts"), "utf8");
  expect(source).toContain("body.simulation === true");
  expect(source).toContain("Use the staging-only simulation endpoint");
});

test("simulation service writes canonical CSD and audit records", () => {
  const source = readFileSync(path.join(process.cwd(), "src/server/services/stagingVerificationSimulationService.ts"), "utf8");
  expect(source).toContain("collection(\"documents\").doc(documentId).set(document");
  expect(source).toContain("STAGING_CSD_SIMULATION");
  expect(source).toContain("STAGING_SARS_TCS_SIMULATION");
  expect(source).toContain("recomputeCanonicalDecisionAfterStagingSimulation");
  expect(source.indexOf("STAGING_CSD_SIMULATION")).toBeLessThan(source.indexOf("recomputeCanonicalDecisionAfterStagingSimulation(input.contractorId)"));
});



function verifiedDocument(type: string, updatedAt: string): ContractorDocument {
  return {
    id: type,
    contractorId: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
    documentType: type,
    fileUrl: `https://example.com/${type}.pdf`,
    verified: true,
    verifiedAt: Date.parse(updatedAt),
    updatedAt: Date.parse(updatedAt),
    status: "verified",
  };
}

const mandatoryDocuments = [
  verifiedDocument("cipc", "2026-08-12T08:00:00.000Z"),
  verifiedDocument("bbbee", "2026-08-12T08:00:00.000Z"),
  verifiedDocument("taxClearance", "2026-08-12T08:00:00.000Z"),
  verifiedDocument("coida", "2026-08-12T08:00:00.000Z"),
  verifiedDocument("bankConfirmation", "2026-08-12T08:00:00.000Z"),
];

function stagingContractor(overrides: Record<string, unknown> = {}) {
  return {
    id: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
    contractorId: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
    legalName: "Torque Empire STAGING TEST Contractor",
    companyName: "Torque Empire STAGING TEST Contractor",
    taxpayerName: "Torque Empire STAGING TEST Contractor",
    status: "active",
    csdNumber: "MAAA9999999",
    companyRegistrationNumber: "2024/105084/07",
    decisionEvaluatedAt: "2026-08-12T08:05:00.000Z",
    decisionLogicVersion: "contractor-repository-decision-v1",
    updatedAt: "2026-08-12T08:05:00.000Z",
    sarsTcsSummary: simulatedSarsRecord(),
    ...overrides,
  };
}

describe("staging simulation canonical recomputation freshness", () => {
  test("new CSD staging evidence is stale before recompute and current after the decision timestamp is persisted", () => {
    const newCsdEvidence = verifiedDocument("csd", "2026-08-12T08:10:00.000Z");
    const stale = buildContractorRepositoryDecision({
      evaluatedAt: "2026-08-12T08:11:00.000Z",
      contractor: stagingContractor(),
      documents: [...mandatoryDocuments, newCsdEvidence],
      allowStagingSimulation: true,
    });
    expect(stale.staleReasons).toContain("Evidence is newer than stored readiness/compliance summary");

    const current = buildContractorRepositoryDecision({
      evaluatedAt: "2026-08-12T08:12:00.000Z",
      contractor: stagingContractor({
        decisionEvaluatedAt: "2026-08-12T08:12:00.000Z",
        readinessUpdatedAt: "2026-08-12T08:12:00.000Z",
        updatedAt: "2026-08-12T08:12:00.000Z",
      }),
      documents: [...mandatoryDocuments, newCsdEvidence],
      allowStagingSimulation: true,
    });
    expect(current.staleReasons).not.toContain("Evidence is newer than stored readiness/compliance summary");
  });

  test("new SARS staging evidence is stale before recompute and current after the decision timestamp is persisted", () => {
    const freshSars = { ...simulatedSarsRecord(), updatedAt: "2026-08-12T08:10:00.000Z", verifiedAt: "2026-08-12T08:10:00.000Z" };
    const stale = buildContractorRepositoryDecision({
      evaluatedAt: "2026-08-12T08:11:00.000Z",
      contractor: stagingContractor({ sarsTcsSummary: freshSars }),
      documents: mandatoryDocuments,
      allowStagingSimulation: true,
    });
    expect(stale.staleReasons).toContain("Evidence is newer than stored readiness/compliance summary");

    const current = buildContractorRepositoryDecision({
      evaluatedAt: "2026-08-12T08:12:00.000Z",
      contractor: stagingContractor({
        sarsTcsSummary: freshSars,
        decisionEvaluatedAt: "2026-08-12T08:12:00.000Z",
        readinessUpdatedAt: "2026-08-12T08:12:00.000Z",
        updatedAt: "2026-08-12T08:12:00.000Z",
      }),
      documents: mandatoryDocuments,
      allowStagingSimulation: true,
    });
    expect(current.staleReasons).not.toContain("Evidence is newer than stored readiness/compliance summary");
  });

  test("changing evidence again after recompute returns the stale-evidence blocker", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: "2026-08-12T08:20:00.000Z",
      contractor: stagingContractor({
        decisionEvaluatedAt: "2026-08-12T08:12:00.000Z",
        readinessUpdatedAt: "2026-08-12T08:12:00.000Z",
        updatedAt: "2026-08-12T08:12:00.000Z",
      }),
      documents: [...mandatoryDocuments, verifiedDocument("csd", "2026-08-12T08:13:00.000Z")],
      allowStagingSimulation: true,
    });
    expect(decision.staleReasons).toContain("Evidence is newer than stored readiness/compliance summary");
  });
});

