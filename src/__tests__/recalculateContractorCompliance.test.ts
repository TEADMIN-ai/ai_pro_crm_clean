import { sanitizeComplianceDocumentBreakdownForFirestore } from "@/lib/server/recalculateContractorCompliance";

describe("recalculateContractorCompliance sanitizer", () => {
  test("normalizes optional compliance breakdown fields before Firestore persistence", () => {
    const sanitized = sanitizeComplianceDocumentBreakdownForFirestore([
      {
        documentType: "taxClearance",
        label: "Tax Clearance",
        weight: 30,
        status: "uploaded",
        weightedScore: 8,
        complianceScore: 25,
        confidenceScore: 82,
        verified: false,
        expiresAt: null,
        reason: "Awaiting review",
        suggestions: ["Upload updated TCS certificate"],
        missingFields: [],
        taxDocumentCategory: undefined,
        taxDocumentPurpose: undefined,
        taxClassificationConfidence: undefined,
        taxComplianceCapable: undefined,
        taxSupportingOnly: undefined,
        readinessImpactReason: undefined,
      },
    ]);

    expect(sanitized).toEqual([
      expect.objectContaining({
        documentType: "taxClearance",
        taxDocumentCategory: null,
        taxDocumentPurpose: null,
        taxClassificationConfidence: null,
        taxComplianceCapable: null,
        taxSupportingOnly: null,
        readinessImpactReason: null,
      }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain("undefined");
  });
});
