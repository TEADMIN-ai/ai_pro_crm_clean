import {
  calculateContractorCompliance,
  normalizeSupportedDocumentType,
  toLegacyComplianceRequirementKey,
} from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

describe("contractor compliance normalization", () => {
  test("normalizes compliance document aliases consistently", () => {
    expect(normalizeSupportedDocumentType("bbbee")).toBe("bbbee");
    expect(normalizeSupportedDocumentType("B-BBEE")).toBe("bbbee");
    expect(normalizeSupportedDocumentType("bbee")).toBe("bbbee");
    expect(normalizeSupportedDocumentType("tax")).toBe("taxClearance");
    expect(normalizeSupportedDocumentType("Tax Clearance")).toBe("taxClearance");
    expect(normalizeSupportedDocumentType("Tax Compliance Status")).toBe("taxClearance");
    expect(normalizeSupportedDocumentType("TCS PIN Document")).toBe("taxClearance");
    expect(normalizeSupportedDocumentType("bank confirmation")).toBe("bankConfirmation");
  });

  test("maps canonical types to legacy readiness keys", () => {
    expect(toLegacyComplianceRequirementKey("taxClearance")).toBe("tax");
    expect(toLegacyComplianceRequirementKey("TCS PIN Document")).toBe("tax");
    expect(toLegacyComplianceRequirementKey("B-BBEE")).toBe("bbbee");
    expect(toLegacyComplianceRequirementKey("bankConfirmation")).toBe("bank");
  });

  test("counts verified aliased document types toward readiness", () => {
    const documents: ContractorDocument[] = [
      { id: "1", contractorId: "c1", documentType: "cipc", fileUrl: "https://example.com/cipc.pdf", verified: true },
      { id: "2", contractorId: "c1", documentType: "Tax Clearance", fileUrl: "https://example.com/tax.pdf", verified: true },
      { id: "3", contractorId: "c1", documentType: "B-BBEE", fileUrl: "https://example.com/bbbee.pdf", verified: true },
      { id: "4", contractorId: "c1", documentType: "coida", fileUrl: "https://example.com/coida.pdf", verified: true },
      {
        id: "5",
        contractorId: "c1",
        documentType: "bank confirmation",
        fileUrl: "https://example.com/bank.pdf",
        verified: true,
      },
    ];

    const summary = calculateContractorCompliance(documents);

    expect(summary.docsMissing).toBe(0);
    expect(summary.readinessScore).toBe(100);
    expect(summary.tenderLockStatus).toBe("READY");
  });

  test("does not count supporting-only SARS registration notices as verified tax compliance", () => {
    const documents: ContractorDocument[] = [
      { id: "1", contractorId: "c1", documentType: "cipc", fileUrl: "https://example.com/cipc.pdf", verified: true },
      {
        id: "2",
        contractorId: "c1",
        documentType: "taxClearance",
        fileUrl: "https://example.com/sars-registration.pdf",
        verified: false,
        status: "uploaded",
        taxDocumentCategory: "SARS_NOTICE_OF_REGISTRATION",
        taxDocumentPurpose: "SARS_REGISTRATION_PROOF",
        taxSupportingOnly: true,
        taxComplianceCapable: false,
      },
    ];

    const summary = calculateContractorCompliance(documents);

    expect(summary.missingDocumentTypes).toContain("taxClearance");
    expect(summary.tenderLockStatus).toBe("BLOCKED");
  });
});
