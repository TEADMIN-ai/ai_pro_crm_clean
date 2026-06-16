import type {
  VehicleFinanceBankField,
  VehicleFinanceBankFingerprint,
  VehicleFinanceBankLineItem,
  VehicleFinanceBankStatementStructuredExtraction,
  VehicleFinanceBankTransaction,
} from "@/types/vehicleFinance";
import { calculateVehicleFinanceAffordability } from "../affordability/vehicleFinanceAffordability";
import {
  buildCommitmentSummary,
  buildGamblingRisk,
  buildSalaryIntelligence,
  compact,
  detectBankFingerprint,
  detectTransactions,
  field,
  extractDate,
  labelledMoney,
  labelledValue,
  normalizeText,
  parseAmount,
  splitLines,
} from "./bankTemplateUtils";
import type { BankTemplateConfig } from "./bankTemplateUtils";

function buildConfidence(values: Array<VehicleFinanceBankField | undefined | null>): number {
  const scores = values
    .map((entry) => entry?.confidence ?? 0)
    .filter((value) => value > 0);
  if (!scores.length) {
    return 0;
  }
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function findTopBankName(lines: string[]): VehicleFinanceBankField | null {
  const line = lines.slice(0, 10).find((entry) => /capitec|fnb|first national bank|absa|standard bank|nedbank|discovery bank|investec|tyme bank|african bank|wesbank/i.test(entry));
  return line ? field(line, 90, line) : null;
}

function findAccountHolder(lines: string[]): VehicleFinanceBankField | null {
  const direct = labelledValue(lines, [/^\s*(?:account\s+holder|account\s+name|account\s+owner|customer\s+name|profile\s+name)\b/i], true, 95);
  if (direct?.value) {
    return field(String(direct.value), direct.confidence, direct.sourceText);
  }

  const candidate = lines.find((line) =>
    /[A-Za-z]/.test(line) &&
    !/statement|balance|transaction|date|account|branch|deposit|payment|salary|income|opening|closing|available|summary/i.test(line),
  );
  return candidate ? field(candidate, 74, candidate) : null;
}

function findAccountNumber(lines: string[]): VehicleFinanceBankField | null {
  const direct = labelledValue(lines, [/^\s*(?:account\s+number|acc\s*no\.?|account\s*no\.?|account\s*nr\.?)\b/i], true, 95);
  if (direct?.value) {
    const digits = compact(String(direct.value)).replace(/[^\da-z]/gi, "");
    return field(digits || compact(String(direct.value)), direct.confidence, direct.sourceText);
  }

  for (const line of lines) {
    const match = line.match(/\b\d{8,18}\b/);
    if (match?.[0] && /account|acc|no|number/i.test(line)) {
      return field(match[0], 82, line);
    }
  }

  return null;
}

function findStatementPeriod(lines: string[]): VehicleFinanceBankField | null {
  const direct = labelledValue(lines, [/^\s*(?:statement\s+period|period|from\s+date|to\s+date|accounting\s+period)\b/i], true, 92);
  if (direct?.value) {
    return field(direct.value, direct.confidence, direct.sourceText);
  }

  const from = lines.find((line) => /from\s+date/i.test(line) || /^from\s+\d{4}[-/]\d{2}[-/]\d{2}/i.test(line));
  const to = lines.find((line) => /to\s+date/i.test(line) || /^to\s+\d{4}[-/]\d{2}[-/]\d{2}/i.test(line));
  if (from || to) {
    const value = [from ?? "", to ?? ""].filter(Boolean).join(" | ");
    return field(value, 88, value);
  }

  const dates = lines.map((line) => extractDate(line)).filter((value): value is string => Boolean(value));
  if (dates.length >= 2) {
    const value = `${dates[0]} to ${dates[dates.length - 1]}`;
    return field(value, 80, value);
  }

  return null;
}

function findBalance(lines: string[], labels: RegExp[], confidence = 95): VehicleFinanceBankField | null {
  const direct = labelledMoney(lines, labels, confidence);
  if (direct) {
    return field(direct.value, direct.confidence, direct.sourceText);
  }
  for (const line of lines) {
    if (labels.some((pattern) => pattern.test(line))) {
      const amount = parseAmount(line);
      if (amount !== null) {
        return field(amount, 90, line);
      }
    }
  }
  return null;
}

function deriveEmployerName(salaryDeposits: VehicleFinanceBankLineItem[]): VehicleFinanceBankField {
  const first = salaryDeposits[0];
  if (!first) {
    return field(null, 0, "");
  }

  const candidate = compact(first.sourceText)
    .replace(/\b(?:salary|wages|payroll|remuneration|payment received|income deposit|employer deposit)\b/gi, "")
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, "")
    .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, "")
    .replace(/-?(?:R\s*)?\d[\d\s,]*(?:\.\d{2})?/g, "")
    .trim();

  if (!candidate) {
    return field(null, 0, first.sourceText);
  }

  return field(candidate, Math.max(72, first.confidence - 8), first.sourceText);
}

function buildTransactionFields(transactions: VehicleFinanceBankTransaction[]) {
  return transactions.map((transaction): VehicleFinanceBankLineItem => ({
    type: transaction.category,
    amount: transaction.amount,
    date: transaction.date,
    confidence: transaction.confidence,
    sourceText: transaction.sourceText,
  }));
}

export function extractBankStatementCore(
  text: string,
  config: BankTemplateConfig,
): VehicleFinanceBankStatementStructuredExtraction {
  const normalized = normalizeText(text);
  const lines = splitLines(normalized);
  const bankFingerprint: VehicleFinanceBankFingerprint = detectBankFingerprint(normalized, config);
  const transactions = detectTransactions(lines);
  const salaryIntelligence = buildSalaryIntelligence(transactions);
  const commitmentSummary = buildCommitmentSummary(transactions);
  const gamblingRisk = buildGamblingRisk(transactions, Number(salaryIntelligence.averageSalary.value ?? 0) || 0);
  const affordability = calculateVehicleFinanceAffordability(salaryIntelligence, commitmentSummary, gamblingRisk);

  const bankName = field(bankFingerprint.bankName, bankFingerprint.confidence, bankFingerprint.sourceText);
  const bankFingerprintField = bankFingerprint;
  const bankVersion = field(bankFingerprint.documentVersion, bankFingerprint.confidence, bankFingerprint.sourceText);
  const statementLayout = field(bankFingerprint.statementLayout, bankFingerprint.confidence, bankFingerprint.sourceText);
  const accountHolder = findAccountHolder(lines) ?? field(null, 0, "");
  const accountNumber = findAccountNumber(lines) ?? field(null, 0, "");
  const statementPeriod = findStatementPeriod(lines) ?? field(null, 0, "");
  const openingBalance = findBalance(lines, [/^\s*(?:opening\s+balance|balance\s+brought\s+forward)\b/i]) ?? field(null, 0, "");
  const closingBalance = findBalance(lines, [/^\s*(?:closing\s+balance|ending\s+balance|balance\s+carried\s+forward)\b/i]) ?? field(null, 0, "");

  const salaryDeposits = salaryIntelligence.salaryDeposits;
  const recurringCommitments = commitmentSummary.recurringCommitments;
  const gamblingTransactions = buildTransactionFields(transactions.filter((transaction) => transaction.category === "Gambling"));

  const grossIncome = field(Number(salaryIntelligence.averageSalary.value ?? 0) || 0, salaryIntelligence.averageSalary.confidence, salaryIntelligence.averageSalary.sourceText);
  const disposableIncome = field(Number(affordability.disposableIncome.value ?? 0) || 0, affordability.disposableIncome.confidence, affordability.disposableIncome.sourceText);
  const employerName = deriveEmployerName(salaryIntelligence.salaryDeposits);
  const latestSalary = salaryIntelligence.salaryDeposits[salaryIntelligence.salaryDeposits.length - 1] ?? null;

  return {
    bankName,
    bankFingerprint: bankFingerprintField,
    documentVersion: bankVersion,
    statementLayout,
    confidence: buildConfidence([
      bankName,
      accountHolder,
      accountNumber,
      statementPeriod,
      openingBalance,
      closingBalance,
      grossIncome,
      disposableIncome,
    ]),
    accountHolder,
    accountNumber,
    statementPeriod,
    openingBalance,
    closingBalance,
    averageMonthlyIncome: grossIncome,
    disposableIncomeEstimate: disposableIncome,
    monthlyDebtCommitments: commitmentSummary.monthlyDebtCommitments,
    monthlyInsuranceCommitments: commitmentSummary.monthlyInsuranceCommitments,
    monthlyTelecomCommitments: commitmentSummary.monthlyTelecomCommitments,
    salaryDeposits,
    recurringCommitments,
    gamblingTransactions,
    transactions: transactions.map((transaction) => ({
      ...transaction,
    })),
    salaryIntelligence,
    commitmentSummary,
    gamblingRisk,
    affordability,
    crossDocumentPreparation: {
      employeeName: accountHolder,
      employerName,
      netPay: latestSalary ? field(latestSalary.amount ?? null, latestSalary.confidence, latestSalary.sourceText) : field(null, 0, ""),
      salaryDeposits: salaryIntelligence.salaryDeposits,
    },
  };
}
