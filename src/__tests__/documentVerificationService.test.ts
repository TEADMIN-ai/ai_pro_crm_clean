import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";

jest.mock("@/lib/pdf/extractTextFromPdf", () => ({
  extractTextFromPdf: jest.fn(),
}));

const { extractTextFromPdf } = jest.requireMock("@/lib/pdf/extractTextFromPdf") as {
  extractTextFromPdf: jest.MockedFunction<(buffer: Buffer) => Promise<string>>;
};

describe("documentVerificationService", () => {
  beforeEach(() => {
    extractTextFromPdf.mockReset();
  });

  test("returns REVIEW when no usable text was extracted", async () => {
    extractTextFromPdf.mockResolvedValue("   ");

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("No usable text extracted from document");
    expect(result.suggestions).toEqual([
      "Please verify registration number manually",
      "Document may be valid but could not be confidently parsed",
      "Please upload a clearer or text-based version for automatic verification",
    ]);
  });

  test("returns REVIEW for weak but relevant CIPC evidence", async () => {
    extractTextFromPdf.mockResolvedValue(
      [
        "CIPC",
        "Companies and Intellectual Property Commission",
        "Registration certificate",
        "Registration No: 2018/12",
      ].join("\n")
    );

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(70);
    expect(result.missingFields).toContain("registrationNumber");
    expect(result.suggestions).toContain("Please verify registration number manually");
    expect(result.confidenceNotes).toContain("CIPC or company registration wording detected");
  });

  test("returns PASS for strong CIPC evidence with exact registration match", async () => {
    extractTextFromPdf.mockResolvedValue(
      [
        "CIPC",
        "Companies and Intellectual Property Commission",
        "Company Registration Certificate",
        "Registration Number: 2018/123456/07",
      ].join("\n")
    );

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.extractedFields.registrationNumber).toBe("2018/123456/07");
  });

  test("returns FAIL for clearly unrelated non-CIPC documents", async () => {
    extractTextFromPdf.mockResolvedValue(
      [
        "Tax Clearance Certificate",
        "Tax Compliance Status PIN",
        "SARS",
      ].join("\n")
    );

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("FAIL");
    expect(result.reason).toBe("Document appears unrelated to CIPC registration");
    expect(result.suggestions).toEqual(["Provide valid CIPC registration document"]);
  });

  test("degrades to REVIEW if text extraction throws", async () => {
    extractTextFromPdf.mockRejectedValue(new Error("ocr exploded"));

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("Document text extraction failed");
    expect(result.suggestions).toContain("Please verify registration number manually");
  });
});
