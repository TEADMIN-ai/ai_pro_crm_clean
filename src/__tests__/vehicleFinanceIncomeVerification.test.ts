import { extractBankStatementDetails } from "@/lib/vehicle-finance/extractors/bankStatementExtractor";

describe("vehicle finance income verification", () => {
  test("extracts salary intelligence and cross-document preparation from a bank statement", () => {
    const extraction = extractBankStatementDetails(`
      FNB eStatements
      Account Holder: John Doe
      Account Number: 1234567890
      Statement Period: 2026-05-01 to 2026-05-31
      Salary Payment 2026-05-25 R 19 094.18
      Salary Payment 2026-04-25 R 19 094.18
      Loan Payment R 1 500.00
      Insurance R 500.00
      MTN R 199.00
      Betway R 150.00
      Closing Balance: R 14 003.34
    `);

    expect(extraction.bankFingerprint.bankName).toBe("FNB");
    expect(extraction.transactions.length).toBeGreaterThan(0);
    expect(extraction.salaryIntelligence?.averageSalary.value).toBeGreaterThan(0);
    expect(extraction.salaryIntelligence?.salaryFrequency.value).toBe("MONTHLY");
    expect(extraction.commitmentSummary?.totalMonthlyCommitments.value).toBeGreaterThan(0);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(extraction.gamblingRisk?.riskLevel);
    expect(extraction.affordability?.affordabilityScore.value).toBeGreaterThan(0);
    expect(extraction.crossDocumentPreparation.netPay.value).toBeGreaterThan(0);
  });
});
