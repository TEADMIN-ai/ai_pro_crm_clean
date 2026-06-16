import { classifyVehicleFinanceDocument } from "@/lib/vehicle-finance/classification/documentClassifier";
import { extractPayslipDetails } from "@/lib/vehicle-finance/extractors/payslipExtractor";
import { verifyPayslipExtraction } from "@/lib/vehicle-finance/verification/payslipVerification";

describe("vehicle finance payslip intelligence", () => {
  test("classifies payslip text", () => {
    const classification = classifyVehicleFinanceDocument(`
      Promolab (Pty) Ltd
      Employee Name: John Doe
      Employee Number: 12345
      Gross Earnings 24616.19
      Total Deductions 4632.19
      Net Pay 19984.00
    `);

    expect(classification.documentType).toBe("PAYSLIP");
    expect(classification.confidence).toBeGreaterThan(0);
  });

  test("extracts structured payslip intelligence from a standard fixture", () => {
    const extraction = extractPayslipDetails(`
      ABC Holdings (Pty) Ltd
      Employee Name: John Doe
      Employee Number: EMP-12345
      Designation: Sales Consultant
      Pay Period: 2026-05-01 to 2026-05-31
      Pay Date: 2026-05-31
      Gross Earnings 24616.19
      PAYE 3875.62
      UIF 177.12
      Medical Aid 450.00
      Total Deductions 4632.19
      Net Pay 19984.00
      Provident Fund 129.45
    `);

    expect(extraction.documentType).toBe("PAYSLIP");
    expect(extraction.employerName.value).toBe("ABC Holdings (Pty) Ltd");
    expect(extraction.employeeName.value).toBe("John Doe");
    expect(extraction.employeeNumber.value).toBe("EMP-12345");
    expect(extraction.designation.value).toBe("Sales Consultant");
    expect(extraction.grossEarnings.value).toBe(24616.19);
    expect(extraction.totalDeductions.value).toBe(4632.19);
    expect(extraction.netPay.value).toBe(19984);
    expect(extraction.payDate.value).toBe("2026-05-31");
    expect(extraction.payPeriod.value).toContain("2026-05-01");
    expect(extraction.deductions.length).toBeGreaterThan(0);
    expect(extraction.benefits.length).toBeGreaterThan(0);
    expect(extraction.crossDocumentPreparation.employeeName.value).toBe("John Doe");
    expect(extraction.crossDocumentPreparation.surname.value).toBe("Doe");
    expect(extraction.confidence).toBeGreaterThan(0);
  });

  test("extracts payslip intelligence from an OCR degraded variant", () => {
    const extraction = extractPayslipDetails(`
      XYZ Logistics
      Staff Name
      Jane Smith
      Staff Number
      S-0042
      Job Title
      Driver
      Gross Salary
      R 18 250.50
      PAYE
      R 2 900.00
      UIF
      R 177.12
      Net Salary
      R 15 173.38
      Date Paid
      2026/06/15
    `);

    expect(extraction.employerName.value).toBe("XYZ Logistics");
    expect(extraction.employeeName.value).toBe("Jane Smith");
    expect(extraction.employeeNumber.value).toBe("S-0042");
    expect(extraction.designation.value).toBe("Driver");
    expect(extraction.grossEarnings.value).toBe(18250.5);
    expect(extraction.netPay.value).toBe(15173.38);
    expect(extraction.payDate.value).toBe("2026/06/15");
  });

  test("verifies payslip extraction and emits missing field flags", () => {
    const verification = verifyPayslipExtraction({
      documentType: "PAYSLIP",
      employerName: { value: null, confidence: 0, sourceText: "" },
      employeeName: { value: "John Doe", confidence: 94, sourceText: "Employee Name: John Doe" },
      employeeNumber: { value: "EMP-12345", confidence: 94, sourceText: "Employee Number: EMP-12345" },
      designation: { value: "Sales Consultant", confidence: 90, sourceText: "Designation: Sales Consultant" },
      grossEarnings: { value: null, confidence: 0, sourceText: "" },
      totalDeductions: { value: 4632.19, confidence: 90, sourceText: "Total Deductions 4632.19" },
      netPay: { value: 19984, confidence: 98, sourceText: "Net Pay 19984.00" },
      payDate: { value: null, confidence: 0, sourceText: "" },
      payPeriod: { value: "2026-05-01 to 2026-05-31", confidence: 90, sourceText: "Pay Period" },
      benefits: [],
      deductions: [],
      confidence: 88,
      crossDocumentPreparation: {
        employeeName: { value: "John Doe", confidence: 94, sourceText: "Employee Name: John Doe" },
        surname: { value: "Doe", confidence: 90, sourceText: "Employee Name: John Doe" },
      },
    });

    expect(verification.passed).toBe(false);
    expect(verification.flags).toContain("MISSING_EMPLOYER");
    expect(verification.flags).toContain("MISSING_GROSS_EARNINGS");
    expect(verification.flags).toContain("MISSING_PAY_DATE");
    expect(verification.verificationScore).toBeLessThan(100);
  });
});
