import { buildReadinessSummary } from "@/components/contractors/ContractorOnboardingView";
import type { ContractorDocument } from "@/types/document";

const mandatoryTypes = ["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation"] as const;

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

describe("contractor onboarding approval decision", () => {
  test("allows onboarding portfolio approval when documents are ready even if assignment authority is blocked", () => {
    const summary = buildReadinessSummary(
      mandatoryTypes.map(approvedDocument),
      {
        id: "rwBxCeiW77cvEbUDY6BjFt2FmzI2",
        companyName: "Torque Empire STAGING TEST Contractor",
        readinessScore: 100,
      },
    );

    expect(summary.readinessScore).toBe(100);
    expect(summary.docsMissing).toBe(0);
    expect(summary.reviewRequiredCount).toBe(0);
    expect(summary.canApprove).toBe(true);
  });

  test("blocks onboarding portfolio approval when a mandatory document is missing", () => {
    const summary = buildReadinessSummary(
      mandatoryTypes.filter((type) => type !== "coida").map(approvedDocument),
      { id: "contractor-1", readinessScore: 80 },
    );

    expect(summary.docsMissing).toBe(1);
    expect(summary.missingLabels).toContain("COIDA");
    expect(summary.canApprove).toBe(false);
  });

  test("blocks onboarding portfolio approval when an onboarding document requires review", () => {
    const documents = mandatoryTypes.map(approvedDocument);
    documents[0] = {
      ...documents[0],
      extractionSource: "EMPTY",
      extractedTextLength: 0,
    } as ContractorDocument;

    const summary = buildReadinessSummary(documents, { id: "contractor-1", readinessScore: 100 });

    expect(summary.docsMissing).toBe(0);
    expect(summary.reviewRequiredCount).toBe(1);
    expect(summary.canApprove).toBe(false);
  });
});

