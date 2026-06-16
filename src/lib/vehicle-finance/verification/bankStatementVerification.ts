import type { BankStatementExtraction } from "../extractors/bankStatementExtractor";

export type VehicleFinanceBankStatementVerificationFlag =
  | "MISSING_ACCOUNT_HOLDER"
  | "MISSING_ACCOUNT_NUMBER"
  | "NO_SALARY_DEPOSITS"
  | "HIGH_GAMBLING_ACTIVITY"
  | "HIGH_RECURRING_DEBT"
  | "MISSING_STATEMENT_PERIOD";

export type VehicleFinanceBankStatementVerification = {
  verificationScore: number;
  passed: boolean;
  flags: VehicleFinanceBankStatementVerificationFlag[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missing(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export function verifyBankStatementExtraction(extraction: BankStatementExtraction): VehicleFinanceBankStatementVerification {
  const flags: VehicleFinanceBankStatementVerificationFlag[] = [];
  let score = 100;

  if (missing(extraction.accountHolder.value)) {
    flags.push("MISSING_ACCOUNT_HOLDER");
    score -= 20;
  }

  if (missing(extraction.accountNumber.value)) {
    flags.push("MISSING_ACCOUNT_NUMBER");
    score -= 20;
  }

  if (missing(extraction.statementPeriod.value)) {
    flags.push("MISSING_STATEMENT_PERIOD");
    score -= 15;
  }

  if (!extraction.salaryDeposits.length) {
    flags.push("NO_SALARY_DEPOSITS");
    score -= 25;
  }

  if (extraction.gamblingTransactions.length >= 4) {
    flags.push("HIGH_GAMBLING_ACTIVITY");
    score -= 20;
  }

  if (extraction.recurringCommitments.length >= 6) {
    flags.push("HIGH_RECURRING_DEBT");
    score -= 15;
  }

  if (extraction.accountHolder.confidence < 80) {
    score -= 5;
  }
  if (extraction.accountNumber.confidence < 80) {
    score -= 5;
  }
  if (extraction.statementPeriod.confidence < 80) {
    score -= 5;
  }

  return {
    passed: flags.length === 0,
    verificationScore: clamp(score),
    flags,
  };
}
