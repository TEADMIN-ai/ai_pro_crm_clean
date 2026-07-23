import { buildContractorRepositoryDecision, validateCsdSupplierNumber } from "@/lib/contractors/contractorRepositoryDecision";
import type { ContractorDocument } from "@/types/document";

const now = "2026-07-23T08:00:00.000Z";

function verifiedDocument(type: string, updatedAt = "2026-07-22T08:00:00.000Z"): ContractorDocument {
  return {
    id: type,
    contractorId: "contractor-1",
    documentType: type,
    fileUrl: `https://example.com/${type}.pdf`,
    verified: true,
    verifiedAt: Date.parse(updatedAt),
    updatedAt: Date.parse(updatedAt),
  };
}

const completeDocuments = [
  verifiedDocument("cipc"),
  verifiedDocument("bbbee"),
  verifiedDocument("taxClearance"),
  verifiedDocument("coida"),
  verifiedDocument("bankConfirmation"),
];

describe("contractor repository decision projection", () => {
  it("blocks 5/5 document completeness when SARS verification is pending and evidence is not attached", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: now,
      contractor: {
        id: "contractor-1",
        contractorId: "contractor-1",
        legalName: "Empire Civil Pty Ltd",
        csdNumber: "MAAA000111",
        registrationNumber: "2024/105084/07",
        readinessScore: 100,
        readinessStatus: "READY",
        complianceStatus: "complete",
        overallStatus: "Approved / Compliant",
        readinessUpdatedAt: "2026-07-20T08:00:00.000Z",
        sarsTcsSummary: {
          id: "sars-1",
          workspaceId: "workspace-a",
          contractorId: "contractor-1",
          taxReferenceNumber: "1234567890",
          registeredTaxpayerName: "Empire Civil Pty Ltd",
          pinLastFour: "1234",
          pinStatus: "PROVIDED",
          pinProvidedAt: now,
          pinProvidedBy: "staff-1",
          consentConfirmed: true,
          consentConfirmedAt: now,
          verificationStatus: "PENDING",
          verifiedAt: null,
          taxpayerNameMatch: "NOT_CHECKED",
          taxReferenceMatch: "NOT_CHECKED",
          registrationNumberMatch: "NOT_CHECKED",
          contractorIdentityMatch: "NOT_CHECKED",
          mismatchReasons: [],
          createdAt: now,
          updatedAt: now,
          createdBy: "staff-1",
          version: 1,
          auditTrail: [],
        },
      },
      documents: completeDocuments,
    });

    expect(decision.documentCompletenessScore).toBe(100);
    expect(decision.readinessScore).toBeNull();
    expect(decision.readinessDecisionStatus).not.toBe("READY");
    expect(decision.complianceDecisionStatus).not.toBe("VALID");
    expect(decision.assignmentAllowed).toBe(false);
    expect(decision.blockingReasons).toContain("SARS TCS PIN has not been verified live");
  });

  it("treats Mr K versus TORQUE EMPIRE taxpayer evidence as identity conflict and blocks assignment", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: now,
      contractor: {
        id: "contractor-1",
        contractorId: "contractor-1",
        companyName: "Mr K",
        name: "Mr K",
        taxpayerName: "TORQUE EMPIRE",
        registrationNumber: "2024/105084/07",
        csdNumber: "MISREPRESENT",
        complianceStatus: "complete",
        overallStatus: "Approved / Compliant",
        readinessScore: 100,
        readinessStatus: "READY",
      },
      documents: completeDocuments,
    });

    expect(decision.identityStatus).toBe("CONFLICT");
    expect(decision.identityMatchStatus).toBe("CONFLICT");
    expect(decision.csdValidationStatus).toBe("INVALID");
    expect(decision.readinessScore).toBeNull();
    expect(decision.readinessDecisionStatus).not.toBe("READY");
    expect(decision.assignmentAllowed).toBe(false);
    expect(decision.blockingReasons).toEqual(expect.arrayContaining([
      "SARS taxpayer name does not match contractor business identity",
      "CSD supplier number is not verified as valid",
    ]));
    expect(decision.historicalDecision).toMatchObject({
      readinessScore: 100,
      readinessStatus: "READY",
      complianceStatus: "complete",
      overallStatus: "Approved / Compliant",
    });
  });

  it("marks stored decisions stale when timestamp or logic version is missing or evidence is newer", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: now,
      contractor: {
        id: "contractor-1",
        legalName: "Empire Civil Pty Ltd",
        csdNumber: "MAAA000111",
        readinessScore: 100,
        readinessUpdatedAt: "2026-07-20T08:00:00.000Z",
      },
      documents: [verifiedDocument("cipc", "2026-07-22T08:00:00.000Z")],
    });

    expect(decision.stale).toBe(true);
    expect(decision.staleReasons).toEqual(expect.arrayContaining([
      "Stored readiness/compliance summary has missing or outdated logic version",
      "Evidence is newer than stored readiness/compliance summary",
    ]));

    const missingTimestamp = buildContractorRepositoryDecision({
      evaluatedAt: now,
      contractor: { id: "contractor-2", legalName: "Empire Civil Pty Ltd", csdNumber: "MAAA000111" },
      documents: [],
    });
    expect(missingTimestamp.staleReasons).toContain("Stored readiness/compliance summary has no evaluation timestamp");
  });

  it("allows READY only for verified identity with valid current evidence", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: now,
      contractor: {
        id: "contractor-1",
        contractorId: "contractor-1",
        legalName: "Empire Civil Pty Ltd",
        taxpayerName: "Empire Civil Pty Ltd",
        csdNumber: "MAAA000111",
        registrationNumber: "2024/105084/07",
        readinessUpdatedAt: "2026-07-23T08:00:00.000Z",
        decisionLogicVersion: "contractor-repository-decision-v1",
        sarsTcsSummary: {
          id: "sars-1",
          workspaceId: "workspace-a",
          contractorId: "contractor-1",
          taxReferenceNumber: "1234567890",
          registeredTaxpayerName: "Empire Civil Pty Ltd",
          pinLastFour: "1234",
          pinStatus: "ACTIVE",
          pinProvidedAt: now,
          pinProvidedBy: "staff-1",
          consentConfirmed: true,
          consentConfirmedAt: now,
          verificationStatus: "VERIFIED_COMPLIANT",
          source: "SARS_SOQS",
          verifiedAt: now,
          recheckDueAt: "2026-08-23T08:00:00.000Z",
          taxpayerNameMatch: "MATCH",
          taxReferenceMatch: "MATCH",
          registrationNumberMatch: "MATCH",
          contractorIdentityMatch: "MATCH",
          mismatchReasons: [],
          verificationEvidenceDocumentId: "evidence-1",
          createdAt: now,
          updatedAt: now,
          createdBy: "staff-1",
          version: 1,
          auditTrail: [],
        },
      },
      documents: completeDocuments,
    });

    expect(decision.complianceDecisionStatus).toBe("VALID");
    expect(decision.readinessDecisionStatus).toBe("READY");
    expect(decision.readinessScore).toBe(100);
    expect(decision.assignmentAllowed).toBe(true);
  });

  it("does not accept invalid non-empty CSD identifiers", () => {
    expect(validateCsdSupplierNumber("MISREPRESENT")).toBe("INVALID");
    expect(validateCsdSupplierNumber("some words")).toBe("UNRESOLVED");
    expect(validateCsdSupplierNumber("MAAA000111")).toBe("VALID");
  });
});
