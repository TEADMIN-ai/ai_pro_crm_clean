import { classifyBankStatement } from "@/lib/vehicle-finance/classification/bankStatementClassifier";
import { extractBankStatementDetails } from "@/lib/vehicle-finance/extractors/bankStatementExtractor";
import { verifyBankStatementExtraction } from "@/lib/vehicle-finance/verification/bankStatementVerification";

describe("vehicle finance bank statement intelligence", () => {
  test("classifies a Capitec bank statement", () => {
    const classification = classifyBankStatement(`
      Capitec Bank
      Account Holder: John Doe
      Account Number: 1234567890
      Statement Period: 2026-05-01 to 2026-05-31
      Opening Balance: R 5 864.04
      Closing Balance: R 14 003.34
    `);

    expect(classification.bankName).toBe("CAPITEC");
    expect(classification.confidence).toBeGreaterThan(0);
  });

  test("extracts structured bank statement intelligence from a standard fixture", () => {
    const extraction = extractBankStatementDetails(`
      FNB
      Account Holder: John Doe
      Account Number: 1234567890
      Statement Period: 2026-05-01 to 2026-05-31
      Opening Balance: R 5 864.04
      Salary Payment 2026-05-25 R 19 094.18
      Netflix R 199.00
      Loan Payment R 1 500.00
      Closing Balance: R 14 003.34
    `);

    expect(extraction.documentType).toBe("BANK_STATEMENT");
    expect(extraction.bankName.value).toBe("FNB");
    expect(extraction.accountHolder.value).toBe("John Doe");
    expect(extraction.accountNumber.value).toBe("1234567890");
    expect(extraction.statementPeriod.value).toContain("2026-05-01");
    expect(extraction.openingBalance.value).toBe(5864.04);
    expect(extraction.closingBalance.value).toBe(14003.34);
    expect(extraction.salaryDeposits.length).toBeGreaterThan(0);
    expect(extraction.recurringCommitments.length).toBeGreaterThan(0);
    expect(extraction.gamblingTransactions.length).toBe(0);
    expect(extraction.averageMonthlyIncome.value).toBeGreaterThan(0);
    expect(extraction.disposableIncomeEstimate.value).toBeGreaterThan(0);
    expect(extraction.crossDocumentPreparation.employeeName.value).toBeNull();
    expect(extraction.confidence).toBeGreaterThan(0);
  });

  test("flags gambling and missing statement data", () => {
    const extraction = extractBankStatementDetails(`
      Standard Bank
      Betway R 150.00
      Betway R 250.00
      Betway R 350.00
      Betway R 450.00
      Insurance R 500.00
      Insurance R 500.00
      Insurance R 500.00
      Insurance R 500.00
      Insurance R 500.00
      Insurance R 500.00
    `);

    const verification = verifyBankStatementExtraction(extraction);

    expect(verification.passed).toBe(false);
    expect(verification.flags).toContain("MISSING_ACCOUNT_NUMBER");
    expect(verification.flags).toContain("MISSING_STATEMENT_PERIOD");
    expect(verification.flags).toContain("NO_SALARY_DEPOSITS");
  });

  test("flags missing fields when verification receives empty values", () => {
    const verification = verifyBankStatementExtraction({
      documentType: "BANK_STATEMENT",
      bankNameClassification: { bankName: "UNKNOWN_BANK", confidence: 0, reasons: [] },
      bankName: { value: null, confidence: 0, sourceText: "" },
      accountHolder: { value: null, confidence: 0, sourceText: "" },
      accountNumber: { value: null, confidence: 0, sourceText: "" },
      statementPeriod: { value: null, confidence: 0, sourceText: "" },
      openingBalance: { value: null, confidence: 0, sourceText: "" },
      closingBalance: { value: null, confidence: 0, sourceText: "" },
      averageMonthlyIncome: { value: 0, confidence: 0, sourceText: "" },
      disposableIncomeEstimate: { value: 0, confidence: 0, sourceText: "" },
      salaryDeposits: [],
      recurringCommitments: [],
      gamblingTransactions: [],
      confidence: 0,
      crossDocumentPreparation: {
        employeeName: { value: null, confidence: 0, sourceText: "" },
        employerName: { value: null, confidence: 0, sourceText: "" },
        netPay: { value: null, confidence: 0, sourceText: "" },
        salaryDeposits: [],
      },
    });

    expect(verification.flags).toContain("MISSING_ACCOUNT_HOLDER");
    expect(verification.flags).toContain("MISSING_ACCOUNT_NUMBER");
    expect(verification.flags).toContain("MISSING_STATEMENT_PERIOD");
    expect(verification.flags).toContain("NO_SALARY_DEPOSITS");
  });
});
