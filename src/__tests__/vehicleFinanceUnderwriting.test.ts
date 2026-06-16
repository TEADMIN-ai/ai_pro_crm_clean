import { buildVehicleFinanceDecisionFromIntelligence } from "@/lib/vehicle-finance/underwriting/decisionEngine";
import { calculateFraudRisk } from "@/lib/vehicle-finance/underwriting/fraudRiskEngine";
import { calculateIncomeVerification } from "@/lib/vehicle-finance/underwriting/incomeVerification";

describe("vehicle finance underwriting", () => {
  const driverLicence = {
    verification: { score: 94 },
    crossDocumentVerification: { identityVerificationScore: 96, fraudFlags: [] },
    textQuality: { flags: [] },
  } as any;

  const identity = {
    verification: { score: 95 },
    crossDocumentVerification: { fraudFlags: [] },
  } as any;

  const payslip = {
    extraction: {
      employerName: { value: "ABC Holdings", confidence: 94, sourceText: "Employer Name: ABC Holdings" },
      employeeName: { value: "John Doe", confidence: 94, sourceText: "Employee Name: John Doe" },
      netPay: { value: 18950, confidence: 94, sourceText: "Net Pay 18950.00" },
      grossEarnings: { value: 21000, confidence: 94, sourceText: "Gross Earnings 21000.00" },
      payPeriod: { value: "MONTHLY", confidence: 90, sourceText: "Pay Period: MONTHLY" },
      salaryIntelligence: {
        averageSalary: { value: 18950, confidence: 95, sourceText: "Salary Payment 18950.00" },
        salaryFrequency: { value: "MONTHLY", confidence: 90, sourceText: "Salary Payment 18950.00" },
        salaryConsistency: { value: 92, confidence: 92, sourceText: "Salary Payment 18950.00" },
        latestSalary: { value: 18950, confidence: 94, sourceText: "Salary Payment 18950.00" },
        salaryTrend: { value: "FLAT", confidence: 80, sourceText: "Salary Payment 18950.00" },
        salaryDeposits: [],
        flags: ["SALARY_DETECTED"],
      },
    },
    verification: { verificationScore: 92 },
    sourceTextLength: 128,
    sourceText: "Employer Name: ABC Holdings",
  } as any;

  const bankStatement = {
    verification: { verificationScore: 90, flags: [] },
    extraction: {
      affordability: {
        disposableIncome: { value: 14500, confidence: 95, sourceText: "Disposable Income" },
        affordabilityScore: { value: 91, confidence: 91, sourceText: "Affordability Score" },
        maxAffordableInstalment: { value: 6500, confidence: 91, sourceText: "Max Instalment" },
      },
      salaryIntelligence: {
        averageSalary: { value: 18950, confidence: 95, sourceText: "Salary Payment 18950.00" },
        salaryFrequency: { value: "MONTHLY", confidence: 90, sourceText: "Salary Payment 18950.00" },
        salaryConsistency: { value: 92, confidence: 92, sourceText: "Salary Payment 18950.00" },
        latestSalary: { value: 18950, confidence: 94, sourceText: "Salary Payment 18950.00" },
      },
      commitmentSummary: {
        totalMonthlyCommitments: { value: 2500, confidence: 90, sourceText: "Commitments" },
      },
      gamblingRisk: {
        riskLevel: "LOW",
        gamblingSpend: { value: 0, confidence: 0, sourceText: "" },
        gamblingFrequency: { value: 0, confidence: 0, sourceText: "" },
        gamblingPercentageOfIncome: { value: 0, confidence: 0, sourceText: "" },
        flags: [],
      },
    },
    crossDocumentPreparation: {
      employeeName: { value: "John Doe", confidence: 95, sourceText: "Account Holder: John Doe" },
      employerName: { value: "ABC Holdings", confidence: 95, sourceText: "Salary Payment 18950.00" },
      netPay: { value: 18950, confidence: 95, sourceText: "Salary Payment 18950.00" },
      salaryDeposits: [],
    },
    sourceTextLength: 220,
    sourceText: "Salary Payment 18950.00",
  } as any;

  test("verifies income across payslip and bank statement", () => {
    const result = calculateIncomeVerification(payslip, bankStatement);

    expect(result.incomeVerified).toBe(true);
    expect(result.incomeMatchScore).toBeGreaterThanOrEqual(80);
    expect(result.flags).toContain("INCOME_VERIFIED");
  });

  test("calculates fraud risk from the current intelligence state", () => {
    const result = calculateFraudRisk(driverLicence, identity, payslip, bankStatement);

    expect(result.fraudRisk).toBe("LOW");
    expect(result.fraudScore).toBeLessThanOrEqual(20);
  });

  test("builds a finance recommendation from combined intelligence", () => {
    const decision = buildVehicleFinanceDecisionFromIntelligence({
      driverLicence,
      identity,
      payslip,
      bankStatement,
    });

    expect(decision.financeReadinessScore).toBeGreaterThanOrEqual(80);
    expect(decision.recommendedDecision).toBe("PROCEED");
    expect(decision.decisionReason).toContain("successfully verified");
    expect(decision.certificationRequirements).toContain("All certification requirements satisfied");
  });
});

