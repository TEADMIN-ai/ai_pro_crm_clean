import { calculateVehicleFinanceAffordability } from "@/lib/vehicle-finance/affordability/vehicleFinanceAffordability";

describe("vehicle finance affordability", () => {
  test("derives an affordability score and vehicle bands from salary, commitments, and gambling risk", () => {
    const affordability = calculateVehicleFinanceAffordability(
      {
        averageSalary: { value: 19094.18, confidence: 95, sourceText: "Salary Payment 2026-05-25 R 19 094.18" },
        salaryFrequency: { value: "MONTHLY", confidence: 90, sourceText: "Salary Payment 2026-05-25 R 19 094.18" },
        salaryConsistency: { value: 91, confidence: 91, sourceText: "Salary Payment 2026-05-25 R 19 094.18" },
        latestSalary: { value: 19094.18, confidence: 94, sourceText: "Salary Payment 2026-05-25 R 19 094.18" },
        salaryTrend: { value: "FLAT", confidence: 80, sourceText: "Salary Payment 2026-05-25 R 19 094.18" },
        salaryDeposits: [],
        flags: ["SALARY_DETECTED"],
      },
      {
        monthlyDebtCommitments: { value: 1500, confidence: 90, sourceText: "Loan Payment R 1 500.00" },
        monthlyInsuranceCommitments: { value: 500, confidence: 90, sourceText: "Insurance R 500.00" },
        monthlyTelecomCommitments: { value: 199, confidence: 90, sourceText: "MTN R 199.00" },
        totalMonthlyCommitments: { value: 2199, confidence: 90, sourceText: "Loan Payment R 1 500.00 | Insurance R 500.00 | MTN R 199.00" },
        recurringCommitments: [],
      },
      {
        gamblingSpend: { value: 0, confidence: 0, sourceText: "" },
        gamblingFrequency: { value: 0, confidence: 0, sourceText: "" },
        gamblingPercentageOfIncome: { value: 0, confidence: 0, sourceText: "" },
        riskLevel: "LOW",
        flags: [],
      },
    );

    expect(affordability.grossIncome.value).toBe(19094.18);
    expect(affordability.monthlyCommitments.value).toBe(2199);
    expect(affordability.disposableIncome.value).toBeGreaterThan(0);
    expect(Number(affordability.affordabilityScore.value)).toBeGreaterThan(0);
    expect(String(affordability.starterVehicle.value)).toContain("Starter vehicle");
  });
});

