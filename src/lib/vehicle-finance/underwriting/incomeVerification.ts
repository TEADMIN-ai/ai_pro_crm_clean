import type {
  VehicleFinanceBankStatementIntelligence,
  VehicleFinancePayslipIntelligence,
} from "@/types/vehicleFinance";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asNumber(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function tokenOverlap(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  return left
    .split(" ")
    .filter(Boolean)
    .some((token) => rightTokens.has(token));
}

function salaryAverage(bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined): number {
  return asNumber(bankStatement?.extraction?.salaryIntelligence?.averageSalary?.value ?? bankStatement?.extraction?.averageMonthlyIncome?.value ?? 0);
}

function salaryLatest(bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined): number {
  return asNumber(bankStatement?.extraction?.salaryIntelligence?.latestSalary?.value ?? 0);
}

function salaryFrequency(bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined): string {
  return normalize(String(bankStatement?.extraction?.salaryIntelligence?.salaryFrequency?.value ?? ""));
}

function salaryConsistency(bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined): number {
  return asNumber(bankStatement?.extraction?.salaryIntelligence?.salaryConsistency?.value ?? 0);
}

function incomeVariancePercent(payslipSalary: number, bankSalary: number): number {
  if (payslipSalary <= 0 || bankSalary <= 0) {
    return 100;
  }

  const baseline = Math.max(payslipSalary, bankSalary);
  return Math.abs(payslipSalary - bankSalary) / baseline * 100;
}

export type VehicleFinanceIncomeVerificationResult = {
  incomeVerified: boolean;
  incomeMatchScore: number;
  employerMatchScore: number;
  salaryMatchScore: number;
  salaryFrequencyMatchScore: number;
  salaryConsistencyScore: number;
  incomeVarianceScore: number;
  flags: string[];
};

export function calculateIncomeVerification(
  payslip: VehicleFinancePayslipIntelligence | null | undefined,
  bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined,
): VehicleFinanceIncomeVerificationResult {
  const flags: string[] = [];
  let employerMatchScore = 0;
  let salaryMatchScore = 0;
  let salaryFrequencyMatchScore = 0;
  let salaryConsistencyScore = 0;
  let incomeVarianceScore = 0;

  const payslipEmployer = normalize(String(payslip?.extraction?.employerName?.value ?? ""));
  const bankEmployer = normalize(String(bankStatement?.crossDocumentPreparation?.employerName?.value ?? ""));
  const payslipEmployee = normalize(String(payslip?.extraction?.employeeName?.value ?? ""));
  const bankEmployee = normalize(String(bankStatement?.crossDocumentPreparation?.employeeName?.value ?? ""));
  const payslipNetPay = asNumber(payslip?.extraction?.netPay?.value ?? payslip?.extraction?.grossEarnings?.value ?? 0);
  const bankSalary = salaryAverage(bankStatement);
  const bankLatestSalary = salaryLatest(bankStatement);
  const bankSalaryFrequency = salaryFrequency(bankStatement);
  const bankConsistency = salaryConsistency(bankStatement);

  if (payslipEmployer && bankEmployer) {
    employerMatchScore = payslipEmployer === bankEmployer || tokenOverlap(payslipEmployer, bankEmployer) || tokenOverlap(bankEmployer, payslipEmployer) ? 100 : 35;
  } else if (payslipEmployer || bankEmployer) {
    employerMatchScore = 50;
    flags.push("MISSING_EMPLOYER_MATCH");
  }

  if (payslipNetPay > 0 && bankSalary > 0) {
    const variancePercent = incomeVariancePercent(payslipNetPay, bankSalary);
    salaryMatchScore = clamp(100 - Math.min(100, variancePercent * 4));
    incomeVarianceScore = clamp(100 - Math.min(100, variancePercent * 5));
    if (variancePercent > 20) {
      flags.push("INCOME_VARIANCE_HIGH");
    }
  } else if (payslipNetPay > 0 || bankSalary > 0) {
    salaryMatchScore = 55;
    incomeVarianceScore = 40;
    flags.push("MISSING_SALARY_MATCH");
  }

  if (payslip?.extraction?.payPeriod?.value && bankSalaryFrequency) {
    const payPeriod = normalize(String(payslip.extraction.payPeriod.value));
    salaryFrequencyMatchScore =
      /month/.test(payPeriod) && /month/.test(bankSalaryFrequency)
        ? 100
        : /week/.test(payPeriod) && /week/.test(bankSalaryFrequency)
          ? 95
          : /fortnight|biweek/.test(payPeriod) && /biweek|fortnight/.test(bankSalaryFrequency)
            ? 95
            : 55;
  } else if (payslip?.extraction?.payPeriod?.value || bankSalaryFrequency) {
    salaryFrequencyMatchScore = 60;
    flags.push("MISSING_SALARY_FREQUENCY_MATCH");
  }

  salaryConsistencyScore = bankConsistency > 0 ? clamp(bankConsistency) : 50;
  if (bankConsistency > 0 && bankConsistency < 70) {
    flags.push("SALARY_INCONSISTENT");
  }

  const incomeMatchScore = clamp(
    Math.round(
      employerMatchScore * 0.3 +
        salaryMatchScore * 0.35 +
        salaryFrequencyMatchScore * 0.15 +
        salaryConsistencyScore * 0.1 +
        incomeVarianceScore * 0.1 +
        (bankLatestSalary > 0 ? 5 : 0),
    ),
  );

  const incomeVerified = incomeMatchScore >= 80 && !flags.includes("INCOME_VARIANCE_HIGH");
  if (incomeVerified) {
    flags.push("INCOME_VERIFIED");
  }

  return {
    incomeVerified,
    incomeMatchScore,
    employerMatchScore,
    salaryMatchScore,
    salaryFrequencyMatchScore,
    salaryConsistencyScore,
    incomeVarianceScore,
    flags,
  };
}

