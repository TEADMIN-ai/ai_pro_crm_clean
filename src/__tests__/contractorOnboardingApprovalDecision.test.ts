import {
  buildReadinessSummary,
  canApproveOnboardingLifecycle,
} from "@/components/contractors/ContractorOnboardingView";
import type { ContractorDocument } from "@/types/document";

const mandatoryTypes = ["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation"] as const;
const privilegedViewer = { isPrivileged: true };

function canonicalDecision(readinessDecisionStatus: string, readinessScore: number | null = readinessDecisionStatus === "READY" ? 100 : null) {
  return {
    readinessScore,
    readinessDecisionStatus,
    complianceDecisionStatus: readinessDecisionStatus,
    assignmentAllowed: readinessDecisionStatus === "READY",
    identityMatchStatus: "MATCHED",
    csdValidationStatus: "VALID",
    archived: false,
    historicalDecision: { readinessScore: null, complianceStatus: null },
  };
}

function approvedDocument(documentType: string): ContractorDocument {
  return {
    id: documentType,
    contractorId: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
    documentType,
    fileUrl: "https://example.test/document.pdf",
    verified: true,
    verifiedAt: Date.parse("2026-08-12T08:00:00.000Z"),
    status: "verified",
  } as ContractorDocument;
}

function canEnableApprovalButton(input: {
  status: string;
  complianceApproved?: boolean;
  archived?: boolean;
  documents: ContractorDocument[];
  readinessScore: number;
  canonicalDecision?: ReturnType<typeof canonicalDecision>;
}): boolean {
  const contractor = {
    id: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
    companyName: "Torque Empire STAGING TEST Contractor",
    status: input.status,
    complianceApproved: input.complianceApproved,
    archived: input.archived,
    readinessScore: input.readinessScore,
  };
  const summary = buildReadinessSummary(input.documents, contractor, input.canonicalDecision);
  return summary.canApprove && canApproveOnboardingLifecycle(contractor, privilegedViewer);
}

describe("contractor onboarding approval decision", () => {
  test("enables onboarding lifecycle approval for a privileged viewer when portfolio is ready even if compliance was already approved", () => {
    expect(canEnableApprovalButton({
      status: "onboarding",
      complianceApproved: true,
      documents: mandatoryTypes.map(approvedDocument),
      readinessScore: 100,
      canonicalDecision: canonicalDecision("READY"),
    })).toBe(true);
  });

  test("does not enable onboarding lifecycle approval again after active transition", () => {
    expect(canEnableApprovalButton({
      status: "active",
      complianceApproved: true,
      documents: mandatoryTypes.map(approvedDocument),
      readinessScore: 100,
    })).toBe(false);
  });

  test("blocks onboarding portfolio approval when a mandatory document is missing", () => {
    const documents = mandatoryTypes.filter((type) => type !== "coida").map(approvedDocument);
    const summary = buildReadinessSummary(documents, { id: "contractor-1", status: "onboarding", readinessScore: 80 });

    expect(summary.docsMissing).toBe(1);
    expect(summary.missingLabels).toContain("COIDA");
    expect(canEnableApprovalButton({ status: "onboarding", documents, readinessScore: 80 })).toBe(false);
  });

  test("blocks onboarding portfolio approval when an onboarding document requires review", () => {
    const documents = mandatoryTypes.map(approvedDocument);
    documents[0] = {
      ...documents[0],
      extractionSource: "EMPTY",
      extractedTextLength: 0,
    } as ContractorDocument;

    const summary = buildReadinessSummary(documents, { id: "contractor-1", status: "onboarding", readinessScore: 100 });

    expect(summary.docsMissing).toBe(0);
    expect(summary.reviewRequiredCount).toBe(1);
    expect(canEnableApprovalButton({ status: "onboarding", documents, readinessScore: 100 })).toBe(false);
  });

  test("blocks approval when documents are complete but canonical readiness is blocked", () => {
    const documents = mandatoryTypes.map(approvedDocument);
    const summary = buildReadinessSummary(documents, { id: "contractor-1", status: "onboarding", readinessScore: 100 }, canonicalDecision("BLOCKED", null));

    expect(summary.requiredDocsApprovedCount).toBe(mandatoryTypes.length);
    expect(summary.docsMissing).toBe(0);
    expect(summary.documentReadinessScore).toBe(100);
    expect(summary.readinessScore).toBe(100);
    expect(summary.readinessDecisionStatus).toBe("BLOCKED");
    expect(summary.documentPortfolioComplete).toBe(true);
    expect(summary.canApprove).toBe(false);
    expect(summary.approvalBlockers).toContain("Canonical readiness is BLOCKED.");
    expect(canEnableApprovalButton({ status: "onboarding", documents, readinessScore: 100, canonicalDecision: canonicalDecision("BLOCKED", null) })).toBe(false);
  });

});
