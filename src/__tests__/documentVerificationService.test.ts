import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";

jest.mock("@/lib/pdf/extractTextFromPdf", () => ({
  extractTextFromPdf: jest.fn(),
  extractTextFromPdfDetailed: jest.fn(),
}));

const { extractTextFromPdfDetailed } = jest.requireMock("@/lib/pdf/extractTextFromPdf") as {
  extractTextFromPdfDetailed: jest.MockedFunction<
    (buffer: Buffer) => Promise<{
      text: string;
      source: "PDF_TEXT" | "OCR" | "EMPTY";
      pageCount: number;
      directTextLength: number;
      ocrTextLength: number;
    }>
  >;
};

describe("documentVerificationService", () => {
  beforeEach(() => {
    extractTextFromPdfDetailed.mockReset();
  });

  test("returns REVIEW when no usable text was extracted", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: "   ",
      source: "EMPTY",
      pageCount: 1,
      directTextLength: 0,
      ocrTextLength: 0,
    });

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
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "CIPC",
        "Companies and Intellectual Property Commission",
        "Registration certificate",
        "Registration No: 2018/12",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 88,
      ocrTextLength: 0,
    });

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
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "CIPC",
        "Companies and Intellectual Property Commission",
        "Company Registration Certificate",
        "Registration Number: 2018/123456/07",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 112,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.extractedFields.registrationNumber).toBe("2018/123456/07");
  });

  test("returns FAIL for clearly unrelated non-CIPC documents", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Tax Clearance Certificate",
        "Tax Compliance Status PIN",
        "SARS",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 56,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("FAIL");
    expect(result.reason).toBe("Document appears unrelated to CIPC registration");
    expect(result.suggestions).toEqual(["Provide valid CIPC registration document"]);
  });

  test("degrades to REVIEW if text extraction throws", async () => {
    extractTextFromPdfDetailed.mockRejectedValue(new Error("ocr exploded"));

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "cipc");

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("Document text extraction failed");
    expect(result.suggestions).toContain("Please verify registration number manually");
  });

  test("returns PASS for B-BBEE certificate with usable structured fields", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "B-BBEE INFORMATION",
        "Registration number",
        "Enterprise Name",
        "Registration Date",
        "Enterprise Type",
        "Enterprise Status",
        "2024/105084/07",
        "TORQUE EMPIRE (PTY) LTD",
        "16/02/2024",
        "PRIVATE COMPANY",
        "In Business",
        "ENTERPRISE INFORMATION",
        "Certificate Number",
        "Total Number of Shareholders",
        "Number of Black Shareholders",
        "Number of White Shareholders",
        "Black Ownership Percentage",
        "White Ownership Percentage",
        "B-BBEE Status",
        "Date of Issue",
        "Expiry Date",
        "9439002571",
        "TWO (2) SHAREHOLDER(S)",
        "TWO (2) BLACK SHAREHOLDER(S)",
        "ZERO (0) WHITE SHAREHOLDER(S)",
        "100% BLACK OWNERSHIP",
        "0% WHITE OWNERSHIP",
        "B-BBEE LEVEL 1 CONTRIBUTOR: 135% PROCUREMENT RECOGNITION",
        "07/07/2025",
        "06/07/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 500,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "bbbee", {
      companyName: "Torque Empire PTY Ltd",
      registrationNumber: "2024/105084/07",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.extractedFields.beeLevel).toBe("1");
    expect(result.extractedFields.certificateNumber).toBe("9439002571");
    expect(result.extractedFields.companyName).toBe("TORQUE EMPIRE");
    expect(result.extractedFields.expectedCompanyMatch).toBe("true");
    expect(result.extractedFields.expectedRegistrationMatch).toBe("true");
  });

  test("returns REVIEW for SARS registration notice without tax clearance evidence", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS",
        "NOTICE OF REGISTRATION",
        "PAYROLL TAX",
        "Registered name: TORQUE EMPIRE",
        "Taxpayer Reference No: 7110832245",
        "Date: 2025-06-12",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 180,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("SARS registration document detected, but active Tax Compliance Status proof is still required.");
    expect(result.extractedFields.taxpayerReference).toBe("7110832245");
    expect(result.taxClassification).toEqual(
      expect.objectContaining({
        category: "SARS_NOTICE_OF_REGISTRATION",
        purpose: "SARS_REGISTRATION_PROOF",
        complianceCapable: false,
        supportingOnly: true,
      }),
    );
    expect(result.extractedFields.taxDocumentCategory).toBe("SARS_NOTICE_OF_REGISTRATION");
    expect(result.suggestions).toContain("Upload an active Tax Compliance Status (TCS) PIN document.");
  });

  test("returns PASS for tax clearance certificate with TCS pin, issue date, and company match", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS Tax Compliance Status",
        "Tax Compliance Status PIN: A1B2C3D4E5",
        "Taxpayer Reference No: 7110832245",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "Date of Issue: 01/04/2026",
        "Valid Until: 31/12/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 220,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.reason).toBe("TCS PIN document detected and validated successfully.");
    expect(result.extractedFields.taxPin).toBe("A1B2C3D4E5");
    expect(result.extractedFields.issueDate).toBe("01/04/2026");
    expect(result.extractedFields.expectedCompanyMatch).toBe("true");
    expect(result.taxClassification).toEqual(
      expect.objectContaining({
        category: "TCS_PIN_DOCUMENT",
        purpose: "ACTIVE_TAX_COMPLIANCE_PROOF",
        complianceCapable: true,
      }),
    );
  });

  test("returns PASS when structured PDF text uses Tax reference No label", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS Tax Compliance Status",
        "Tax Compliance Status PIN: A1B2C3D4E5",
        "Tax reference No: 9962522182",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "Date of Issue: 01/04/2026",
        "Valid Until: 31/12/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 220,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.extractedFields.taxpayerReference).toBe("9962522182");
    expect(result.extractedFields.taxpayerReferenceMatchedLabel).toBe("Tax reference No");
  });

  test("extracts SARS TCS taxpayer name from OCR address block", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS",
        "South African Revenue Service",
        "TAX COMPLIANCE STATUS",
        "PIN Issued",
        "Details",
        "Taxpayer Reference Number: 9090826257",
        "Always quote this reference number when contacting SARS",
        "Issue Date: 2025/05/19",
        "MACKAY AND DAUGHTERS ENTERPRISE",
        "11 CECIL DANIEL STREET",
        "ELDORADO PARK",
        "Dear Taxpayer",
        "Tax Compliance Status PIN Issued",
        "Expiry Date: 18/05/2027",
      ].join("\n"),
      source: "OCR",
      pageCount: 1,
      directTextLength: 0,
      ocrTextLength: 400,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Mackay and Daughters Enterprises",
    });

    expect(result.status).toBe("REVIEW");
    expect(result.extractedFields.taxPin).toBeNull();
    expect(result.extractedFields.taxpayerReference).toBe("9090826257");
    expect(result.extractedFields.taxpayerName).toBe("MACKAY AND DAUGHTERS ENTERPRISE");
    expect(result.extractedFields.expectedCompanyMatch).toBe("true");
  });

  test("normalizes spaced taxpayer reference when label and value are split across lines", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS Tax Compliance Status",
        "Tax Compliance Status PIN: A1B2C3D4E5",
        "Taxpayer Reference Number",
        "996 252 2182",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "Date of Issue: 01/04/2026",
        "Valid Until: 31/12/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 220,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.extractedFields.taxpayerReference).toBe("9962522182");
    expect(result.extractedFields.taxpayerReferenceRawValue).toBe("996 252 2182");
  });

  test("returns REVIEW instead of EXPIRED when OCR yields conflicting tax dates", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS Tax Compliance Status",
        "Tax Compliance Status PIN: A1B2C3D4E5",
        "Taxpayer Reference No: 7110832245",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "01/04/2026",
        "31/12/2025",
        "31/12/2026",
      ].join("\n"),
      source: "OCR",
      pageCount: 1,
      directTextLength: 0,
      ocrTextLength: 180,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("OCR produced conflicting date candidates");
    expect(result.extractedFields.dateConflict).toBe("true");
    expect(result.extractedFields.expiryDate).toBe("31/12/2026");
  });

  test("returns REVIEW when extracted tax expiry precedes the issue date", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS Tax Compliance Status",
        "Tax Compliance Status PIN: A1B2C3D4E5",
        "Taxpayer Reference No: 7110832245",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "Date of Issue: 01/04/2026",
        "Valid Until: 31/03/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 220,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("Issue date occurs after the extracted expiry date");
    expect(result.extractedFields.dateConflict).toBe("true");
    expect(result.extractedFields.issueDate).toBe("01/04/2026");
    expect(result.extractedFields.expiryDate).toBe("31/03/2026");
  });

  test("returns REVIEW for VAT registration notice without unlocking tax compliance", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS",
        "VAT Notice of Registration",
        "Registered Name: Torque Empire (Pty) Ltd",
        "VAT Registration Number: 4120287654",
        "Taxpayer Reference No: 7110832245",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 180,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("Document confirms VAT registration but does not independently confirm active tax compliance.");
    expect(result.taxClassification).toEqual(
      expect.objectContaining({
        category: "VAT_REGISTRATION_NOTICE",
        complianceCapable: false,
        supportingOnly: true,
      }),
    );
  });

  test("returns PASS for legacy tax clearance certificate when current tax evidence is still present", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Tax Clearance Certificate",
        "SARS",
        "Tax Compliance Status PIN: ABC123XYZ9",
        "Taxpayer Reference No: 7110832245",
        "Taxpayer Name: Torque Empire (Pty) Ltd",
        "Date of Issue: 01/04/2026",
        "Valid Until: 31/12/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 220,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.taxClassification?.category).toBe("LEGACY_TAX_CLEARANCE_CERTIFICATE");
  });

  test("returns REVIEW for ambiguous SARS tax documents that cannot prove active compliance", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "SARS",
        "Tax document",
        "Registered name: Torque Empire (Pty) Ltd",
        "Taxpayer Reference No: 7110832245",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 120,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "taxClearance", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.taxClassification?.category).toBe("UNKNOWN_TAX_DOCUMENT");
    expect(result.reason).toBe("Document confirms SARS registration but does not independently confirm active tax compliance.");
  });

  test("returns PASS for COIDA letter with employer registration, policy reference, and future expiry", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Compensation Fund Letter of Good Standing",
        "Employer Registration Number: 9900001234",
        "Policy Number: CF-2026-001",
        "Employer Name: Torque Empire (Pty) Ltd",
        "Valid Until: 06/07/2026",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 160,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "coida", {
      companyName: "Torque Empire PTY Ltd",
      registrationNumber: "9900001234",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.extractedFields.employerRegistrationNumber).toBe("9900001234");
    expect(result.extractedFields.policyReference).toBe("CF-2026-001");
    expect(result.extractedFields.companyName).toBe("TORQUE EMPIRE");
    expect(result.extractedFields.expectedCompanyMatch).toBe("true");
    expect(result.extractedFields.expectedRegistrationMatch).toBe("true");
  });

  test("returns PASS for proof-of-account with active Capitec business account and contractor match", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Capitec Bank",
        "24/09/2025",
        "Account Confirmation Letter",
        "Client Details",
        "Name: TORQUE EMPIRE (PTY)LTD",
        "Registration/ID Number: 2024/105084/07",
        "Account Details",
        "Account Status: Active",
        "Account Type: Capitec Business Account",
        "Account Name: TORQUE EMPIRE (PTY)LTD",
        "Account Number: 1052177301",
        "Bank Name: Capitec Business",
        "Branch Code: 450105",
        "Unique Document No.: 1914e55f-5d0f-46d9-b8a7-6880f716d68a 406",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 700,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "bankConfirmation", {
      companyName: "Torque Empire PTY Ltd",
      registrationNumber: "2024/105084/07",
      contactPerson: "Chadwin W Karanie",
      relatedParties: ["Chadwin Wesley Karanie"],
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.extractedFields.bankName).toBe("Capitec Business");
    expect(result.extractedFields.accountHolder).toBe("TORQUE EMPIRE (PTY)LTD");
    expect(result.extractedFields.accountStatus).toBe("Active");
    expect(result.extractedFields.accountType).toBe("Capitec Business Account");
    expect(result.extractedFields.branchCode).toBe("450105");
    expect(result.extractedFields.accountNumber).toBe("1052177301");
    expect(result.extractedFields.expectedCompanyMatch).toBe("true");
    expect(result.extractedFields.expectedRegistrationMatch).toBe("true");
  });

  test("returns REVIEW for bank confirmation with partial company linkage", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Capitec Bank",
        "24/09/2025",
        "Account Confirmation Letter",
        "Client Details",
        "Name: TORQUE EMPIRE TRADING",
        "Account Details",
        "Account Status: Active",
        "Account Type: Capitec Business Account",
        "Account Name: C W KARANIE",
        "Account Number: 1052177301",
        "Bank Name: Capitec Business",
        "Branch Code: 450105",
        "Unique Document No.: 1914e55f-5d0f-46d9-b8a7-6880f716d68a 406",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 600,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "bankConfirmation", {
      companyName: "Torque Empire PTY Ltd",
      contactPerson: "Chadwin W Karanie",
      relatedParties: ["Chadwin Wesley Karanie"],
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("REVIEW");
    expect(result.reason).toBe("Business name partially matches contractor profile");
    expect(result.extractedFields.expectedCompanyMatch).toBe("false");
    expect(result.extractedFields.expectedAccountHolderMatch).toBe("true");
  });

  test("returns FAIL for bank confirmation with unsupported structure", async () => {
    extractTextFromPdfDetailed.mockResolvedValue({
      text: [
        "Random attachment",
        "Please pay using this account",
        "Account Number: 1234567890",
      ].join("\n"),
      source: "PDF_TEXT",
      pageCount: 1,
      directTextLength: 90,
      ocrTextLength: 0,
    });

    const result = await verifyStoredContractorDocument(Buffer.from("pdf"), "bankConfirmation", {
      companyName: "Torque Empire PTY Ltd",
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("FAIL");
    expect(result.reason).toBe("Bank verification failed due to unsupported or invalid proof-of-account structure");
  });
});
