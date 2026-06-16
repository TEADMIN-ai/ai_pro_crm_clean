import type {
  VehicleFinanceBankField,
  VehicleFinanceBankLineItem,
  VehicleFinanceBankStatementStructuredExtraction,
} from "@/types/vehicleFinance";
import { classifyBankStatement } from "../classification/bankStatementClassifier";

export type BankStatementExtraction = VehicleFinanceBankStatementStructuredExtraction & {
  documentType: "BANK_STATEMENT";
  bankNameClassification: ReturnType<typeof classifyBankStatement>;
  confidence: number;
  crossDocumentPreparation: {
    employeeName: VehicleFinanceBankField;
    employerName: VehicleFinanceBankField;
    netPay: VehicleFinanceBankField;
    salaryDeposits: VehicleFinanceBankLineItem[];
  };
};

type Candidate<T extends string | number = string> = {
  value: T;
  confidence: number;
  sourceText: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n");
}

function compact(value: string): string {
  return value.replace(/[ \t]+/g, " ").trim();
}

function splitLines(text: string): string[] {
  return normalizeText(text)
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean);
}

function field(value: string | number | null, confidence: number, sourceText: string): VehicleFinanceBankField {
  return { value, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

function item(type: string, amount: number | null, date: string | null, confidence: number, sourceText: string): VehicleFinanceBankLineItem {
  return { type, amount, date, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseAmount(value: string): number | null {
  const normalized = compact(value).replace(/(\d)\s+(?=\d)/g, "$1").replace(/,/g, "");
  const match = normalized.match(/(-?\d[\d]*(?:\.\d{2})?)/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDate(value: string): string | null {
  const match = compact(value).match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/);
  return match?.[1] ?? null;
}

function labelledValue(lines: string[], patterns: RegExp[], nextLine = true, confidence = 94): Candidate | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!patterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    const inline = compact(line.replace(/^.*?[:.\-]\s*/, ""));
    if (inline && !patterns.some((pattern) => pattern.test(inline))) {
      return { value: inline, confidence, sourceText: line };
    }

    if (nextLine) {
      const next = lines[index + 1] ?? "";
      if (next) {
        return { value: next, confidence: Math.max(70, confidence - 10), sourceText: `${line} ${next}` };
      }
    }
  }

  return null;
}

function labelledMoney(lines: string[], patterns: RegExp[], confidence = 95): Candidate<number> | null {
  const candidate = labelledValue(lines, patterns, true, confidence);
  if (!candidate?.value) {
    return null;
  }
  const amount = parseAmount(candidate.value);
  if (amount === null) {
    return null;
  }
  return { value: amount, confidence: candidate.confidence, sourceText: candidate.sourceText };
}

function findTopBankName(lines: string[]): Candidate<string> | null {
  for (const line of lines.slice(0, 10)) {
    if (/capitec|fnb|first national bank|absa|standard bank|nedbank|discovery bank|investec|tyme bank|african bank/i.test(line)) {
      return { value: line, confidence: 96, sourceText: line };
    }
  }
  return null;
}

function findAccountHolder(lines: string[]): Candidate<string> | null {
  const direct = labelledValue(lines, [/^\s*(?:account\s+holder|account\s+name|account\s+owner|customer\s+name)\b/i], true, 95);
  if (direct?.value) {
    return direct;
  }

  const candidate = lines.find((line) => /[A-Za-z]/.test(line) && !/statement|balance|transaction|date|account|branch|deposit|payment|salary|income/i.test(line));
  if (candidate) {
    return { value: candidate, confidence: 76, sourceText: candidate };
  }

  return null;
}

function findAccountNumber(lines: string[]): Candidate<string> | null {
  const direct = labelledValue(lines, [/^\s*(?:account\s+number|acc\s*no\.?|account\s*no\.?)\b/i], true, 95);
  if (direct?.value) {
    const digits = compact(direct.value).replace(/[^\da-z]/gi, "");
    return { value: digits || compact(direct.value), confidence: direct.confidence, sourceText: direct.sourceText };
  }

  for (const line of lines) {
    const match = line.match(/\b\d{8,18}\b/);
    if (match?.[0] && /account|acc|no/i.test(line)) {
      return { value: match[0], confidence: 82, sourceText: line };
    }
  }

  return null;
}

function findStatementPeriod(lines: string[]): Candidate<string> | null {
  const direct = labelledValue(lines, [/^\s*(?:statement\s+period|period|from\s+date|to\s+date)\b/i], true, 92);
  if (direct?.value) {
    return direct;
  }

  const from = lines.find((line) => /from\s+date/i.test(line) || /^from\s+\d{4}[-/]\d{2}[-/]\d{2}/i.test(line));
  const to = lines.find((line) => /to\s+date/i.test(line) || /^to\s+\d{4}[-/]\d{2}[-/]\d{2}/i.test(line));
  if (from || to) {
    return {
      value: [from ?? "", to ?? ""].filter(Boolean).join(" | "),
      confidence: 88,
      sourceText: [from ?? "", to ?? ""].filter(Boolean).join(" | "),
    };
  }

  const dates = lines.map((line) => extractDate(line)).filter((value): value is string => Boolean(value));
  if (dates.length >= 2) {
    return {
      value: `${dates[0]} to ${dates[dates.length - 1]}`,
      confidence: 80,
      sourceText: `${dates[0]} to ${dates[dates.length - 1]}`,
    };
  }

  return null;
}

function findBalance(lines: string[], labels: RegExp[], confidence = 95): Candidate<number> | null {
  const direct = labelledMoney(lines, labels, confidence);
  if (direct) {
    return direct;
  }
  for (const line of lines) {
    if (labels.some((pattern) => pattern.test(line))) {
      const amount = parseAmount(line);
      if (amount !== null) {
        return { value: amount, confidence: 90, sourceText: line };
      }
    }
  }
  return null;
}

function detectTransactions(
  lines: string[],
  labels: Array<{ type: string; patterns: RegExp[]; minConfidence?: number }>,
): VehicleFinanceBankLineItem[] {
  const items: VehicleFinanceBankLineItem[] = [];
  for (const label of labels) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!label.patterns.some((pattern) => pattern.test(line))) {
        continue;
      }
      const next = lines[index + 1] ?? "";
      const amount = parseAmount(line) ?? parseAmount(next);
      const date = extractDate(line) ?? extractDate(next);
      items.push(item(label.type, amount, date, label.minConfidence ?? 88, amount !== null ? line : `${line} ${next}`));
      break;
    }
  }
  return items;
}

function uniqueBySource(items: VehicleFinanceBankLineItem[]): VehicleFinanceBankLineItem[] {
  const seen = new Set<string>();
  return items.filter((entry) => {
    const key = `${entry.type}:${entry.sourceText}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildOverallConfidence(fields: Array<VehicleFinanceBankField>): number {
  const values = fields.map((fieldValue) => fieldValue.confidence).filter((value) => value > 0);
  if (!values.length) {
    return 0;
  }
  return clamp(average(values));
}

export function extractBankStatementDetails(text: string): BankStatementExtraction {
  const normalized = normalizeText(text);
  const linesValue = splitLines(normalized);
  const bankNameClassification = classifyBankStatement(normalized);

  const bankName = bankNameClassification.bankName === "UNKNOWN_BANK"
    ? findTopBankName(linesValue)
    : {
        value: bankNameClassification.bankName,
        confidence: bankNameClassification.confidence,
        sourceText: bankNameClassification.reasons[0] ?? bankNameClassification.bankName,
      };

  const accountHolder = findAccountHolder(linesValue);
  const accountNumber = findAccountNumber(linesValue);
  const statementPeriod = findStatementPeriod(linesValue);
  const openingBalance = findBalance(linesValue, [/^\s*(?:opening\s+balance|balance\s+brought\s+forward)\b/i]);
  const closingBalance = findBalance(linesValue, [/^\s*(?:closing\s+balance|ending\s+balance|balance\s+carried\s+forward)\b/i]);

  const salaryDeposits = uniqueBySource(
    detectTransactions(linesValue, [
      { type: "Salary", patterns: [/salary/i, /salary\s+payment/i, /payroll/i, /payment\s+received/i, /employer\s+deposit/i, /wages/i, /income\s+deposit/i], minConfidence: 95 },
      { type: "Payroll", patterns: [/payroll/i], minConfidence: 92 },
      { type: "Employer Deposit", patterns: [/employer\s+deposit/i], minConfidence: 92 },
    ]),
  );

  const recurringCommitments = uniqueBySource(
    detectTransactions(linesValue, [
      { type: "Insurance", patterns: [/insurance/i], minConfidence: 88 },
      { type: "Loan Payments", patterns: [/loan\s+payment/i, /loan/i], minConfidence: 86 },
      { type: "Credit Card Payments", patterns: [/credit\s+card/i], minConfidence: 88 },
      { type: "Funeral Cover", patterns: [/funeral\s+cover/i], minConfidence: 90 },
      { type: "Internet", patterns: [/internet/i], minConfidence: 85 },
      { type: "Subscriptions", patterns: [/subscription/i, /netflix/i, /dstv/i, /spotify/i, /apple/i], minConfidence: 84 },
      { type: "Store Accounts", patterns: [/store\s+account/i], minConfidence: 85 },
      { type: "MTN", patterns: [/\bmtn\b/i], minConfidence: 84 },
    ]),
  );

  const gamblingTransactions = uniqueBySource(
    detectTransactions(linesValue, [
      { type: "Betway", patterns: [/betway/i], minConfidence: 95 },
      { type: "Hollywoodbets", patterns: [/hollywoodbets/i], minConfidence: 95 },
      { type: "Sportingbet", patterns: [/sportingbet/i], minConfidence: 95 },
      { type: "Lottostar", patterns: [/lottostar/i], minConfidence: 95 },
      { type: "World Sports Betting", patterns: [/world\s+sports\s+betting/i], minConfidence: 95 },
      { type: "BetXchange", patterns: [/betxchange/i], minConfidence: 95 },
    ]),
  );

  const averageMonthlyIncome = salaryDeposits.length
    ? salaryDeposits.reduce((sum, entry) => sum + (entry.amount ?? 0), 0) / salaryDeposits.length
    : 0;

  const estimatedRecurringObligations = recurringCommitments.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const disposableIncomeEstimate = Math.max(0, averageMonthlyIncome - estimatedRecurringObligations);

  const employerName = accountHolder
    ? field(accountHolder.value, Math.max(70, accountHolder.confidence - 8), accountHolder.sourceText)
    : field(null, 0, "");
  const employeeName = field(null, 0, "");
  const netPay = salaryDeposits[0]
    ? field(salaryDeposits[0].amount ?? null, salaryDeposits[0].confidence, salaryDeposits[0].sourceText)
    : field(null, 0, "");

  const fields = {
    bankName: field(bankName?.value ?? null, bankName?.confidence ?? 0, bankName?.sourceText ?? ""),
    accountHolder: field(accountHolder?.value ?? null, accountHolder?.confidence ?? 0, accountHolder?.sourceText ?? ""),
    accountNumber: field(accountNumber?.value ?? null, accountNumber?.confidence ?? 0, accountNumber?.sourceText ?? ""),
    statementPeriod: field(statementPeriod?.value ?? null, statementPeriod?.confidence ?? 0, statementPeriod?.sourceText ?? ""),
    openingBalance: field(openingBalance?.value ?? null, openingBalance?.confidence ?? 0, openingBalance?.sourceText ?? ""),
    closingBalance: field(closingBalance?.value ?? null, closingBalance?.confidence ?? 0, closingBalance?.sourceText ?? ""),
    averageMonthlyIncome: field(averageMonthlyIncome, salaryDeposits.length ? 90 : 0, salaryDeposits.map((entry) => entry.sourceText).join(" | ")),
    disposableIncomeEstimate: field(disposableIncomeEstimate, salaryDeposits.length ? 85 : 0, recurringCommitments.map((entry) => entry.sourceText).join(" | ")),
    salaryDeposits,
    recurringCommitments,
    gamblingTransactions,
  };

  return {
    documentType: "BANK_STATEMENT",
    bankNameClassification,
    ...fields,
    confidence: buildOverallConfidence([
      fields.bankName,
      fields.accountHolder,
      fields.accountNumber,
      fields.statementPeriod,
      fields.openingBalance,
      fields.closingBalance,
      fields.averageMonthlyIncome,
      fields.disposableIncomeEstimate,
    ]),
    crossDocumentPreparation: {
      employeeName,
      employerName,
      netPay,
      salaryDeposits,
    },
  };
}
