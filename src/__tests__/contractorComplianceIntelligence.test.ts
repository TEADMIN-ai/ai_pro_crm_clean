import { buildContractorComplianceIntelligence } from "@/lib/compliance/contractorComplianceIntelligence";
import { calculateContractorCompliance } from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

describe("contractorComplianceIntelligence", () => {
  test("computes high-confidence low-risk intelligence for a complete verified contractor pack", () => {
    const documents: ContractorDocument[] = [
      {
        id: "cipc",
        contractorId: "torque-empire-benchmark",
        documentType: "cipc",
        fileUrl: "https://example.com/cipc.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 96,
      },
      {
        id: "bbbee",
        contractorId: "torque-empire-benchmark",
        documentType: "bbbee",
        fileUrl: "https://example.com/bbbee.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 94,
      },
      {
        id: "taxClearance",
        contractorId: "torque-empire-benchmark",
        documentType: "taxClearance",
        fileUrl: "https://example.com/tax.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 92,
      },
      {
        id: "coida",
        contractorId: "torque-empire-benchmark",
        documentType: "coida",
        fileUrl: "https://example.com/coida.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 90,
      },
      {
        id: "bankConfirmation",
        contractorId: "torque-empire-benchmark",
        documentType: "bankConfirmation",
        fileUrl: "https://example.com/bank.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 88,
      },
    ];

    const summary = calculateContractorCompliance(documents);
    const intelligence = buildContractorComplianceIntelligence("torque-empire-benchmark", documents, summary);

    expect(intelligence.complianceConfidence).toBe(100);
    expect(intelligence.readinessConfidence).toBe(100);
    expect(intelligence.operationalSubmissionConfidence).toBeGreaterThanOrEqual(95);
    expect(intelligence.riskGrade).toBe("LOW RISK");
    expect(intelligence.blockedReasons).toEqual([]);
    expect(intelligence.reviewRecommendations).toEqual([]);
    expect(intelligence.explainableSummary).toContain("Ready because");
  });

  test("produces explainable blockers and recommendations for missing and expired critical documents", () => {
    const documents: ContractorDocument[] = [
      {
        id: "cipc",
        contractorId: "contractor-2",
        documentType: "cipc",
        fileUrl: "https://example.com/cipc.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 90,
      },
      {
        id: "bbbee",
        contractorId: "contractor-2",
        documentType: "bbbee",
        fileUrl: "https://example.com/bbbee.pdf",
        verified: true,
        status: "verified",
        complianceScore: 90,
        confidenceScore: 88,
      },
      {
        id: "coida",
        contractorId: "contractor-2",
        documentType: "coida",
        fileUrl: "https://example.com/coida.pdf",
        verified: false,
        status: "expired",
        complianceScore: 0,
        confidenceScore: 40,
        expiresAt: Date.UTC(2026, 0, 10),
      },
    ];

    const summary = calculateContractorCompliance(documents);
    const intelligence = buildContractorComplianceIntelligence("contractor-2", documents, summary);

    expect(intelligence.riskGrade).toBe("HIGH RISK");
    expect(intelligence.blockedReasons).toEqual(
      expect.arrayContaining([
        "Tax Clearance is missing",
        "COIDA expired on 2026-01-10",
        "Bank Confirmation is missing",
      ]),
    );
    expect(intelligence.reviewRecommendations).toEqual(
      expect.arrayContaining([
        "Upload updated TCS certificate",
        "Renew coida and upload the current document",
        "Upload bank confirmation letter",
      ]),
    );
    expect(intelligence.explainableSummary).toContain("Blocked because");
    expect(intelligence.missingCriticalDocuments).toEqual(
      expect.arrayContaining(["taxClearance", "coida", "bankConfirmation"]),
    );
  });

  test("tracks supporting-only SARS tax documents in explainability and telemetry without unlocking readiness", () => {
    const documents: ContractorDocument[] = [
      {
        id: "cipc",
        contractorId: "contractor-3",
        documentType: "cipc",
        fileUrl: "https://example.com/cipc.pdf",
        verified: true,
        status: "verified",
        complianceScore: 100,
        confidenceScore: 90,
      },
      {
        id: "taxClearance",
        contractorId: "contractor-3",
        documentType: "taxClearance",
        fileUrl: "https://example.com/registration.pdf",
        verified: false,
        status: "uploaded",
        confidenceScore: 84,
        reviewReason: "SARS registration document detected, but active Tax Compliance Status proof is still required.",
        taxDocumentCategory: "SARS_NOTICE_OF_REGISTRATION",
        taxDocumentPurpose: "SARS_REGISTRATION_PROOF",
        taxClassificationConfidence: 90,
        taxComplianceCapable: false,
        taxSupportingOnly: true,
        readinessImpactReason: "SARS registration documents support identity validation but do not satisfy the active tax compliance requirement.",
      },
    ];

    const summary = calculateContractorCompliance(documents);
    const intelligence = buildContractorComplianceIntelligence("contractor-3", documents, summary);

    expect(intelligence.blockedReasons).toContain(
      "SARS registration document detected, but active Tax Compliance Status proof is still required.",
    );
    expect(intelligence.reviewRecommendations).toContain("Upload updated TCS certificate");
    expect(intelligence.documentBreakdown.find((item) => item.documentType === "taxClearance")).toEqual(
      expect.objectContaining({
        taxDocumentCategory: "SARS_NOTICE_OF_REGISTRATION",
        taxSupportingOnly: true,
        taxComplianceCapable: false,
      }),
    );
    expect(intelligence.telemetry.taxDocumentCategories.SARS_NOTICE_OF_REGISTRATION).toBe(1);
    expect(intelligence.telemetry.supportingOnlyTaxDocumentCount).toBe(1);
    expect(intelligence.telemetry.complianceCapableTaxDocumentCount).toBe(0);
    expect(intelligence.telemetry.readinessImpactReasons).toContain(
      "SARS registration documents support identity validation but do not satisfy the active tax compliance requirement.",
    );
  });
});
