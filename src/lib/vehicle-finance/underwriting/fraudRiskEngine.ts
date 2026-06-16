import type {
  VehicleFinanceBankStatementIntelligence,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinancePayslipIntelligence,
} from "@/types/vehicleFinance";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export type VehicleFinanceFraudRiskResult = {
  fraudRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  fraudScore: number;
  flags: string[];
};

export function calculateFraudRisk(
  driverLicence: VehicleFinanceDriverLicenceIntelligence | null | undefined,
  identity: VehicleFinanceIdentityDocumentIntelligence | null | undefined,
  payslip: VehicleFinancePayslipIntelligence | null | undefined,
  bankStatement: VehicleFinanceBankStatementIntelligence | null | undefined,
): VehicleFinanceFraudRiskResult {
  const flags: string[] = [];
  let score = 0;

  const driverFlags = driverLicence?.crossDocumentVerification?.fraudFlags ?? [];
  const identityFlags = identity?.crossDocumentVerification?.fraudFlags ?? [];
  if (driverFlags.some((flag) => /MISMATCH|DOB|GENDER|SURNAME|FORENAME/.test(flag))) {
    score += 25;
    flags.push(...driverFlags);
  }
  if (identityFlags.some((flag) => /MISMATCH|DOB|GENDER|SURNAME|FORENAME/.test(flag))) {
    score += 25;
    flags.push(...identityFlags);
  }

  const payslipText = [payslip?.sourceText, payslip?.selectedText, payslip?.extraction?.employerName?.sourceText, payslip?.extraction?.employeeName?.sourceText]
    .filter(Boolean)
    .join(" ");
  const salaryMentions = (payslipText.match(/salary|wages|payroll|remuneration/gi) ?? []).length;
  if ((salaryMentions >= 2 || (bankStatement?.extraction?.salaryIntelligence?.flags ?? []).includes("MULTIPLE_SALARY_SOURCES"))) {
    score += 12;
    flags.push("MULTIPLE_SALARY_SOURCES");
  }

  const gamblingRisk = bankStatement?.extraction?.gamblingRisk?.riskLevel ?? "LOW";
  if (gamblingRisk === "MEDIUM") {
    score += 10;
    flags.push("MODERATE_GAMBLING_ACTIVITY");
  } else if (gamblingRisk === "HIGH") {
    score += 20;
    flags.push("HIGH_GAMBLING_ACTIVITY");
  } else if (gamblingRisk === "CRITICAL") {
    score += 30;
    flags.push("HIGH_GAMBLING_ACTIVITY", "MODERATE_GAMBLING_ACTIVITY");
  }

  const missingFields = [
    missing(driverLicence?.extraction?.name) ? "MISSING_NAME" : null,
    missing(driverLicence?.extraction?.surname) ? "MISSING_SURNAME" : null,
    missing(identity?.extraction?.idNumber?.value) ? "MISSING_ID_NUMBER" : null,
    missing(payslip?.extraction?.employerName?.value) ? "MISSING_EMPLOYER" : null,
    missing(payslip?.extraction?.employeeName?.value) ? "MISSING_EMPLOYEE_NAME" : null,
    missing(bankStatement?.extraction?.accountNumber?.value) ? "MISSING_ACCOUNT_NUMBER" : null,
    missing(bankStatement?.extraction?.statementPeriod?.value) ? "MISSING_STATEMENT_PERIOD" : null,
  ].filter((value): value is string => Boolean(value));

  if (missingFields.length) {
    score += Math.min(20, missingFields.length * 4);
    flags.push(...missingFields);
  }

  const ocrAnomalies = [
    driverLicence?.textQuality?.flags?.length ? driverLicence.textQuality.flags : [],
    identity?.sourceTextLength === 0 ? ["EMPTY_IDENTITY_TEXT"] : [],
    payslip?.sourceTextLength === 0 ? ["EMPTY_PAYSLIP_TEXT"] : [],
    bankStatement?.sourceTextLength === 0 ? ["EMPTY_BANK_TEXT"] : [],
  ].flat();
  if (ocrAnomalies.length) {
    score += Math.min(20, ocrAnomalies.length * 3);
    flags.push(...ocrAnomalies);
  }

  const fraudScore = clamp(score);
  const fraudRisk = fraudScore <= 20 ? "LOW" : fraudScore <= 45 ? "MEDIUM" : fraudScore <= 75 ? "HIGH" : "CRITICAL";

  return { fraudRisk, fraudScore, flags };
}
