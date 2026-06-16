import type {
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinancePayslipIntelligence,
  VehicleFinanceBankStatementIntelligence,
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

function tokenOverlap(left: string, right: string): boolean {
  if (!left || !right) return false;
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  return left.split(" ").filter(Boolean).some((token) => rightTokens.has(token));
}

export type VehicleFinanceEmploymentVerificationResult = {
  employmentVerified: boolean;
  employmentMatchScore: number;
  employerMatchScore: number;
  employeeMatchScore: number;
  flags: string[];
};

export function calculateEmploymentVerification(
  driverLicence: VehicleFinanceDriverLicenceIntelligence | null | undefined,
  identity: VehicleFinanceIdentityDocumentIntelligence | null | undefined,
  payslip: VehicleFinancePayslipIntelligence | null | undefined,
  bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined,
): VehicleFinanceEmploymentVerificationResult {
  const flags: string[] = [];
  const payslipEmployee = normalize(String(payslip?.extraction?.employeeName?.value ?? ""));
  const identityEmployee = normalize(
    String(identity?.extraction?.forenames?.value ?? identity?.extraction?.surname?.value ?? ""),
  );
  const driverEmployee = normalize(String(driverLicence?.extraction?.name ?? ""));
  const bankEmployee = normalize(String(bankStatement?.crossDocumentPreparation?.employeeName?.value ?? ""));
  const payslipEmployer = normalize(String(payslip?.extraction?.employerName?.value ?? ""));
  const bankEmployer = normalize(String(bankStatement?.crossDocumentPreparation?.employerName?.value ?? ""));

  let employeeMatchScore = 0;
  if (payslipEmployee && (identityEmployee || driverEmployee)) {
    const source = identityEmployee || driverEmployee;
    employeeMatchScore = payslipEmployee === source || tokenOverlap(payslipEmployee, source) || tokenOverlap(source, payslipEmployee) ? 100 : 45;
  } else if (payslipEmployee || identityEmployee || driverEmployee) {
    employeeMatchScore = 55;
    flags.push("MISSING_EMPLOYEE_LINK");
  }

  let employerMatchScore = 0;
  if (payslipEmployer && bankEmployer) {
    employerMatchScore = payslipEmployer === bankEmployer || tokenOverlap(payslipEmployer, bankEmployer) || tokenOverlap(bankEmployer, payslipEmployer) ? 100 : 40;
  } else if (payslipEmployer || bankEmployer) {
    employerMatchScore = 60;
    flags.push("MISSING_EMPLOYER_LINK");
  }

  const verificationBoost =
    (driverLicence?.verification?.score ?? 0) * 0.2 +
    (identity?.verification?.score ?? 0) * 0.2 +
    (payslip?.verification?.verificationScore ?? 0) * 0.3 +
    (bankStatement?.verification?.verificationScore ?? 0) * 0.3;

  const employmentMatchScore = clamp(Math.round(employeeMatchScore * 0.45 + employerMatchScore * 0.35 + verificationBoost * 0.2));
  const employmentVerified = employmentMatchScore >= 75;
  if (employmentVerified) {
    flags.push("EMPLOYMENT_VERIFIED");
  }

  return {
    employmentVerified,
    employmentMatchScore,
    employerMatchScore,
    employeeMatchScore,
    flags,
  };
}

