import { buildContractorOnboardingDecisionView } from "@/lib/contractors/contractorOnboardingDecisionView";
import type { ContractorDocument } from "@/types/document";

const now = "2026-07-23T08:00:00.000Z";

function verifiedDocument(type: string): ContractorDocument {
  return {
    id: type,
    contractorId: "contractor-1",
    documentType: type,
    fileUrl: `https://example.com/${type}.pdf`,
    verified: true,
    verifiedAt: Date.parse("2026-07-22T08:00:00.000Z"),
    updatedAt: Date.parse("2026-07-22T08:00:00.000Z"),
  };
}

const completeDocuments = [
  verifiedDocument("cipc"),
  verifiedDocument("bbbee"),
  verifiedDocument("taxClearance"),
  verifiedDocument("coida"),
  verifiedDocument("bankConfirmation"),
];

const compliantContractor = {
  id: "contractor-1",
  contractorId: "contractor-1",
  legalName: "Empire Civil Pty Ltd",
  taxpayerName: "Empire Civil Pty Ltd",
  csdNumber: "MAAA000111",
  registrationNumber: "2024/105084/07",
  readinessUpdatedAt: now,
  decisionLogicVersion: "contractor-repository-decision-v1",
  sarsTcsSummary: {
    id: "sars-1",
    workspaceId: "workspace-a",
    contractorId: "contractor-1",
    taxReferenceNumber: "1234567890",
    registeredTaxpayerName: "Empire Civil Pty Ltd",
    pinStatus: "ACTIVE",
    consentConfirmed: true,
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
};

describe("contractor onboarding decision view", () => {
  it("blocks incomplete evidence and does not expose READY or assignment authority", () => {
    const view = buildContractorOnboardingDecisionView({
      evaluatedAt: now,
      contractor: compliantContractor,
      documents: [verifiedDocument("cipc")],
    });

    expect(view.documentSummary.docsMissing).toBeGreaterThan(0);
    expect(view.readinessDecisionStatus).not.toBe("READY");
    expect(view.readinessScore).toBeNull();
    expect(view.assignmentAllowed).toBe(false);
    expect(view.assignmentSummary).toMatchObject({
      status: "BLOCKED",
      assignmentAllowed: false,
      authority: "contractor-repository-decision",
    });
    expect(view.overallStatus).not.toBe("Approved / Compliant");
  });

  it("marks uploaded blocked-review evidence as review required and blocks assignment", () => {
    const reviewDocument: ContractorDocument = {
      ...verifiedDocument("taxClearance"),
      verified: false,
      verifiedAt: undefined,
      validationStatus: "REVIEW",
      manualDecisionAvailable: true,
      status: "uploaded",
    };

    const view = buildContractorOnboardingDecisionView({
      evaluatedAt: now,
      contractor: compliantContractor,
      documents: [
        verifiedDocument("cipc"),
        verifiedDocument("bbbee"),
        reviewDocument,
        verifiedDocument("coida"),
        verifiedDocument("bankConfirmation"),
      ],
    });

    expect(view.reviewSummary.status).toBe("REVIEW_REQUIRED");
    expect(view.reviewSummary.reviewRequiredCount).toBe(1);
    expect(view.readinessDecisionStatus).not.toBe("READY");
    expect(view.assignmentSummary.status).toBe("BLOCKED");
    expect(view.assignmentSummary.assignmentAllowed).toBe(false);
  });

  it("allows assignment only when the canonical repository decision is READY", () => {
    const view = buildContractorOnboardingDecisionView({
      evaluatedAt: now,
      contractor: compliantContractor,
      documents: completeDocuments,
    });

    expect(view.readinessDecisionStatus).toBe("READY");
    expect(view.assignmentAllowed).toBe(true);
    expect(view.assignmentSummary).toMatchObject({
      status: "ALLOWED",
      assignmentAllowed: true,
      blockingReasons: [],
    });
    expect(view.overallStatus).toBe("Approved / Compliant");
  });
});
