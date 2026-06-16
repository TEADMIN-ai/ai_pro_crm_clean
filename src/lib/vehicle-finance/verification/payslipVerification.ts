import type { PayslipExtraction } from "../extractors/payslipExtractor";

export type VehicleFinancePayslipVerificationFlag =
  | "MISSING_EMPLOYER"
  | "MISSING_EMPLOYEE_NAME"
  | "MISSING_GROSS_EARNINGS"
  | "MISSING_NET_PAY"
  | "MISSING_PAY_DATE";

export type VehicleFinancePayslipVerification = {
  passed: boolean;
  verificationScore: number;
  flags: VehicleFinancePayslipVerificationFlag[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missing(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export function verifyPayslipExtraction(extraction: PayslipExtraction): VehicleFinancePayslipVerification {
  const flags: VehicleFinancePayslipVerificationFlag[] = [];
  let score = 100;

  if (missing(extraction.employerName.value)) {
    flags.push("MISSING_EMPLOYER");
    score -= 20;
  } else if (extraction.employerName.confidence < 80) {
    score -= 5;
  }

  if (missing(extraction.employeeName.value)) {
    flags.push("MISSING_EMPLOYEE_NAME");
    score -= 20;
  } else if (extraction.employeeName.confidence < 80) {
    score -= 5;
  }

  if (missing(extraction.grossEarnings.value)) {
    flags.push("MISSING_GROSS_EARNINGS");
    score -= 20;
  } else if (extraction.grossEarnings.confidence < 80) {
    score -= 5;
  }

  if (missing(extraction.netPay.value)) {
    flags.push("MISSING_NET_PAY");
    score -= 20;
  } else if (extraction.netPay.confidence < 80) {
    score -= 5;
  }

  if (missing(extraction.payDate.value)) {
    flags.push("MISSING_PAY_DATE");
    score -= 20;
  } else if (extraction.payDate.confidence < 80) {
    score -= 5;
  }

  return {
    passed: flags.length === 0,
    verificationScore: clamp(score),
    flags,
  };
}
