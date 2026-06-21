import type {
  VehicleFinanceBankAffordability,
  VehicleFinanceBankCommitmentSummary,
  VehicleFinanceBankField,
  VehicleFinanceBankFingerprint,
  VehicleFinanceBankGamblingRisk,
  VehicleFinanceBankLineItem,
  VehicleFinanceBankSalaryIntelligence,
  VehicleFinanceBankStatementStructuredExtraction,
  VehicleFinanceBankStatementVerification,
  VehicleFinanceBankTransaction,
  VehicleFinanceRiskLevel,
} from "@/types/vehicleFinance";
import type { VehicleFinanceBankName } from "../classification/bankStatementClassifier";

export type BankTemplateVersionHint = {
  pattern: RegExp;
  documentVersion: string;
  statementLayout: string;
  confidence: number;
};

export type BankTemplateConfig = {
  bankName: VehicleFinanceBankName;
  displayName: string;
  brandingSignals: RegExp[];
  versionHints: BankTemplateVersionHint[];
  layoutSignals: RegExp[];
  footerSignals: RegExp[];
  summarySignals: RegExp[];
};

export type BankTemplateDetection = VehicleFinanceBankFingerprint;

export type BankTemplate = {
  bankName: VehicleFinanceBankName;
  detect: (text: string) => BankTemplateDetection;
  extract: (text: string) => VehicleFinanceBankStatementStructuredExtraction;
  verify: (
    extraction: VehicleFinanceBankStatementStructuredExtraction,
  ) => VehicleFinanceBankStatementVerification;
  confidence: (text: string) => number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function normalizeText(value: string): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n");
}

export function compact(value: string): string {
  return value.replace(/[ \t]+/g, " ").trim();
}

export function splitLines(text: string): string[] {
  return normalizeText(text)
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean);
}

export function field(value: string | number | null, confidence: number, sourceText: string): VehicleFinanceBankField {
  return { value, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

export function item(
  type: string,
  amount: number | null,
  date: string | null,
  confidence: number,
  sourceText: string,
): VehicleFinanceBankLineItem {
  return { type, amount, date, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

export function parseAmount(value: string): number | null {
  const withoutDates = compact(value)
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, " ")
    .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, " ")
    .replace(/\b\d{2}[-/]\d{2}[-/]\d{2}\b/g, " ");

  const cleaned = withoutDates
    .replace(/(?:^|[^0-9])-?R\s*/gi, "")
    .replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.includes(",") && !cleaned.includes(".")
    ? cleaned.replace(/\s+/g, "").replace(/,/g, ".")
    : cleaned.replace(/\s+/g, "").replace(/,/g, "");

  const match = normalized.match(/-?\d+(?:\.\d{2})?/);
  if (!match?.[0]) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractDate(value: string): string | null {
  const match = compact(value).match(
    /\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{2}[-/]\d{2}[-/]\d{2})\b/,
  );
  return match?.[1] ?? null;
}

export function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length !== 3) {
    return null;
  }

  const [first, second, third] = parts.map((part) => Number(part));
  if ([first, second, third].some((part) => Number.isNaN(part))) {
    return null;
  }

  let year = third;
  let month = second - 1;
  let day = first;

  if (String(first).length === 4) {
    year = first;
    month = second - 1;
    day = third;
  }

  if (year < 100) {
    year += year > 50 ? 1900 : 2000;
  }

  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function labelledValue(lines: string[], patterns: RegExp[], nextLine = true, confidence = 94, anchorDepth = 8) {
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
      for (let offset = 1; offset <= anchorDepth; offset += 1) {
        const next = lines[index + offset] ?? "";
        if (next && !patterns.some((pattern) => pattern.test(next))) {
          return { value: next, confidence: Math.max(70, confidence - offset * 4), sourceText: `${line} ${next}` };
        }
      }
    }
  }

  return null;
}

export function labelledMoney(lines: string[], patterns: RegExp[], confidence = 95) {
  const candidate = labelledValue(lines, patterns, true, confidence);
  if (!candidate?.value) {
    return null;
  }

  const amount = parseAmount(String(candidate.value));
  if (amount === null) {
    return null;
  }

  return { value: amount, confidence: candidate.confidence, sourceText: candidate.sourceText };
}

export function scoreFingerprint(matches: number[], runnerUpMatches = 0): number {
  const total = matches.reduce((sum, value) => sum + value, 0);
  return clamp(40 + total * 12 - runnerUpMatches * 8);
}

function gatherFingerprintLines(lines: string[], patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      hits.push(line);
    }
  }
  return hits;
}

export function detectBankFingerprint(text: string, config: BankTemplateConfig): VehicleFinanceBankFingerprint {
  const normalized = normalizeText(text);
  const lines = splitLines(normalized);
  const topLines = lines.slice(0, 12);
  const footerLines = lines.slice(Math.max(0, lines.length - 12));

  const brandHits = config.brandingSignals.filter((pattern) => pattern.test(normalized)).length;
  const layoutHits = config.layoutSignals.filter((pattern) => pattern.test(normalized)).length;
  const footerHits = config.footerSignals.filter((pattern) => pattern.test(footerLines.join("\n"))).length;
  const summaryHits = config.summarySignals.filter((pattern) => pattern.test(lines.join("\n"))).length;
  const versionHint = config.versionHints.find((hint) => hint.pattern.test(normalized)) ?? null;

  const confidence = scoreFingerprint([brandHits * 2, layoutHits, footerHits, summaryHits], 0);
  const reasons = [
    ...(gatherFingerprintLines(topLines, config.brandingSignals).length ? [`Top-of-document branding detected for ${config.displayName}`] : []),
    ...(gatherFingerprintLines(lines, config.layoutSignals).length ? [`Statement layout keywords detected for ${config.displayName}`] : []),
    ...(gatherFingerprintLines(footerLines, config.footerSignals).length ? [`Footer markers detected for ${config.displayName}`] : []),
  ];

  return {
    bankName: config.bankName,
    documentVersion: versionHint?.documentVersion ?? null,
    statementLayout: versionHint?.statementLayout ?? (summaryHits > 0 ? "SUMMARY_LAYOUT" : layoutHits > 0 ? "TRANSACTION_LAYOUT" : null),
    confidence: versionHint ? Math.max(confidence, versionHint.confidence) : confidence,
    sourceText: [...gatherFingerprintLines(topLines, config.brandingSignals), ...(versionHint ? [versionHint.pattern.source ?? versionHint.documentVersion] : [])]
      .filter(Boolean)
      .join(" | "),
    reasons: reasons.length ? reasons : [`Detected ${config.displayName}`],
  };
}

export function detectTransactionCategory(description: string): string {
  const lower = description.toLowerCase();
  if (/salary|wages|payroll|remuneration|payment received|income deposit|employer deposit/.test(lower)) {
    return "Salary";
  }
  if (/betway|hollywoodbets|sportingbet|lottostar|world\s*sports\s*betting|betxchange|supabets|easybet/.test(lower)) {
    return "Gambling";
  }
  if (/insurance|discovery|1life|old mutual|clientele|momentum|funeral cover/.test(lower)) {
    return "Insurance";
  }
  if (/mtn|vodacom|telkom|cell c|cellc|telecom/.test(lower)) {
    return "Telecom";
  }
  if (/credit card|loan|vehicle finance|home loan|retail credit|payflex|mobicred|payjustnow|retail account|store account/.test(lower)) {
    return "Debt";
  }
  if (/cash withdrawal|atm/.test(lower)) {
    return "Withdrawal";
  }
  if (/transfer|eft|payment/.test(lower)) {
    return "Transfer";
  }
  return "Transaction";
}

export function inferDirection(description: string, amount: number | null): "CREDIT" | "DEBIT" | "UNKNOWN" {
  const lower = description.toLowerCase();
  if (/salary|wages|payroll|remuneration|deposit|income/.test(lower)) {
    return "CREDIT";
  }
  if (/withdrawal|debit|payment|purchase|fee|loan|insurance|betway|hollywoodbets|credit card|retail/.test(lower)) {
    return "DEBIT";
  }
  if (amount !== null) {
    return amount >= 0 ? "CREDIT" : "DEBIT";
  }
  return "UNKNOWN";
}

export function detectTransactions(lines: string[]): VehicleFinanceBankTransaction[] {
  const transactions: VehicleFinanceBankTransaction[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const date = extractDate(line);
    const moneyMatches = [...compact(line).matchAll(/(?:R\s*)?-?\d[\d\s,]*(?:\.\d{2})/g)].map((match) => match[0]).filter(Boolean);
    if (!date && moneyMatches.length === 0) {
      continue;
    }

    const cleanedLine = compact(
      line
        .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, "")
        .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, "")
        .replace(/\b\d{2}[-/]\d{2}[-/]\d{2}\b/g, "")
        .replace(/-?(?:R\s*)?\d[\d\s,]*(?:\.\d{2})?/g, "")
        .replace(/[|]/g, " "),
    );

    const nextLine = lines[index + 1] ?? "";
    const nextDate = !date ? extractDate(nextLine) : null;
    const fallbackDescription = cleanedLine || compact(nextLine.replace(/-?(?:R\s*)?\d[\d\s,]*(?:\.\d{2})?/g, ""));
    const amountCandidate = moneyMatches.length ? parseAmount(moneyMatches[0]) : parseAmount(nextLine);
    const runningBalance = moneyMatches.length > 1 ? parseAmount(moneyMatches[moneyMatches.length - 1]) : null;
    const description = fallbackDescription || (date ? "Transaction" : "");

    if (!description && !amountCandidate && !date && !nextDate) {
      continue;
    }

    transactions.push({
      date: date ?? nextDate,
      description: description || "Transaction",
      category: detectTransactionCategory(description || nextLine),
      amount: amountCandidate,
      direction: inferDirection(description || nextLine, amountCandidate),
      runningBalance,
      confidence: clamp(70 + (date ? 10 : 0) + (amountCandidate !== null ? 10 : 0) + (description ? 5 : 0)),
      sourceText: compact(line),
    });
  }

  const seen = new Set<string>();
  return transactions.filter((transaction) => {
    const key = `${transaction.date ?? ""}|${transaction.description}|${transaction.amount ?? ""}|${transaction.runningBalance ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function averageDurationDays(dates: Date[]): number | null {
  if (dates.length < 2) {
    return null;
  }
  const sorted = [...dates].sort((left, right) => left.getTime() - right.getTime());
  const durations = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const delta = sorted[index].getTime() - sorted[index - 1].getTime();
    durations.push(delta / (1000 * 60 * 60 * 24));
  }
  return average(durations);
}

function salaryFrequencyLabel(days: number | null): string {
  if (days === null) return "UNKNOWN";
  if (days <= 8) return "WEEKLY";
  if (days <= 16) return "BIWEEKLY";
  if (days <= 35) return "MONTHLY";
  if (days <= 70) return "BIMONTHLY";
  return "IRREGULAR";
}

export function buildSalaryIntelligence(transactions: VehicleFinanceBankTransaction[]): VehicleFinanceBankSalaryIntelligence {
  const salaryDeposits = transactions
    .filter((transaction) => transaction.category === "Salary" || transaction.direction === "CREDIT")
    .filter((transaction) => /salary|wages|payroll|remuneration|payment received|income deposit|employer deposit/i.test(transaction.description));

  const salaryAmounts = salaryDeposits.map((transaction) => transaction.amount).filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));
  const salaryDates = salaryDeposits
    .map((transaction) => parseDate(transaction.date ?? ""))
    .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));

  const averageSalary = salaryAmounts.length ? salaryAmounts.reduce((sum, amount) => sum + amount, 0) / salaryAmounts.length : 0;
  const latestSalary = salaryAmounts.length ? salaryAmounts[salaryAmounts.length - 1] : 0;
  const intervalDays = averageDurationDays(salaryDates);
  const salaryFrequency = salaryFrequencyLabel(intervalDays);

  let consistency = 0;
  if (salaryAmounts.length >= 2) {
    const mean = averageSalary || 1;
    const variance = salaryAmounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / salaryAmounts.length;
    const stdDev = Math.sqrt(variance);
    consistency = clamp(100 - Math.min(60, (stdDev / mean) * 100));
  } else if (salaryAmounts.length === 1) {
    consistency = 85;
  }

  let trend = "INSUFFICIENT_DATA";
  if (salaryAmounts.length >= 2) {
    const first = salaryAmounts[0];
    const last = salaryAmounts[salaryAmounts.length - 1];
    trend = last > first ? "UPWARD" : last < first ? "DOWNWARD" : "FLAT";
  }

  const descriptionSet = new Set(salaryDeposits.map((transaction) => transaction.description.toLowerCase()));
  const flags = ["SALARY_DETECTED"];
  if (consistency > 0 && consistency < 70) {
    flags.push("SALARY_INCONSISTENT");
  }
  if (descriptionSet.size > 1) {
    flags.push("MULTIPLE_SALARY_SOURCES");
  }

  const sourceText = salaryDeposits.map((transaction) => transaction.sourceText).join(" | ");

  return {
    averageSalary: field(averageSalary, salaryAmounts.length ? 95 : 0, sourceText),
    salaryFrequency: field(salaryFrequency, salaryAmounts.length ? 88 : 0, sourceText),
    salaryConsistency: field(consistency, salaryAmounts.length ? consistency : 0, sourceText),
    latestSalary: field(latestSalary, salaryAmounts.length ? 94 : 0, sourceText),
    salaryTrend: field(trend, salaryAmounts.length ? 82 : 0, sourceText),
    salaryDeposits: salaryDeposits.map((transaction) =>
      item("Salary", transaction.amount ?? null, transaction.date, transaction.confidence, transaction.sourceText),
    ),
    flags,
  };
}

function sumTransactionAmounts(transactions: VehicleFinanceBankTransaction[]): number {
  return transactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount ?? 0), 0);
}

export function buildCommitmentSummary(transactions: VehicleFinanceBankTransaction[]): VehicleFinanceBankCommitmentSummary {
  const debtTransactions = transactions.filter((transaction) => transaction.category === "Debt");
  const insuranceTransactions = transactions.filter((transaction) => transaction.category === "Insurance");
  const telecomTransactions = transactions.filter((transaction) => transaction.category === "Telecom");
  const recurringTransactions = [...debtTransactions, ...insuranceTransactions, ...telecomTransactions];

  return {
    monthlyDebtCommitments: field(sumTransactionAmounts(debtTransactions), debtTransactions.length ? 90 : 0, debtTransactions.map((entry) => entry.sourceText).join(" | ")),
    monthlyInsuranceCommitments: field(sumTransactionAmounts(insuranceTransactions), insuranceTransactions.length ? 90 : 0, insuranceTransactions.map((entry) => entry.sourceText).join(" | ")),
    monthlyTelecomCommitments: field(sumTransactionAmounts(telecomTransactions), telecomTransactions.length ? 90 : 0, telecomTransactions.map((entry) => entry.sourceText).join(" | ")),
    totalMonthlyCommitments: field(sumTransactionAmounts(recurringTransactions), recurringTransactions.length ? 88 : 0, recurringTransactions.map((entry) => entry.sourceText).join(" | ")),
    recurringCommitments: recurringTransactions.map((transaction) =>
      item(transaction.category, Math.abs(transaction.amount ?? 0), transaction.date, transaction.confidence, transaction.sourceText),
    ),
  };
}

export function buildGamblingRisk(
  transactions: VehicleFinanceBankTransaction[],
  grossIncome: number,
): VehicleFinanceBankGamblingRisk {
  const gamblingTransactions = transactions.filter((transaction) => transaction.category === "Gambling");
  const gamblingSpend = sumTransactionAmounts(gamblingTransactions);
  const gamblingFrequency = gamblingTransactions.length;
  const percentage = grossIncome > 0 ? (gamblingSpend / grossIncome) * 100 : 0;

  let riskLevel: VehicleFinanceRiskLevel = "LOW";
  if (percentage >= 20 || gamblingTransactions.length >= 10) {
    riskLevel = "CRITICAL";
  } else if (percentage >= 10 || gamblingTransactions.length >= 6) {
    riskLevel = "HIGH";
  } else if (percentage >= 5 || gamblingTransactions.length >= 3) {
    riskLevel = "MEDIUM";
  }

  const flags: string[] = [];
  if (riskLevel === "HIGH") {
    flags.push("HIGH_GAMBLING_ACTIVITY");
  } else if (riskLevel === "CRITICAL") {
    flags.push("HIGH_GAMBLING_ACTIVITY", "MODERATE_GAMBLING_ACTIVITY");
  } else if (riskLevel === "MEDIUM") {
    flags.push("MODERATE_GAMBLING_ACTIVITY");
  }

  const sourceText = gamblingTransactions.map((transaction) => transaction.sourceText).join(" | ");
  return {
    gamblingSpend: field(gamblingSpend, gamblingTransactions.length ? 90 : 0, sourceText),
    gamblingFrequency: field(gamblingFrequency, gamblingTransactions.length ? 88 : 0, sourceText),
    gamblingPercentageOfIncome: field(percentage, gamblingTransactions.length ? 86 : 0, sourceText),
    riskLevel,
    flags,
  };
}

export function buildAffordability(
  salary: VehicleFinanceBankSalaryIntelligence,
  commitments: VehicleFinanceBankCommitmentSummary,
  gamblingRisk: VehicleFinanceBankGamblingRisk,
): VehicleFinanceBankAffordability {
  const grossIncome = Number(salary.averageSalary.value ?? 0) || 0;
  const monthlyCommitments = Number(commitments.totalMonthlyCommitments.value ?? 0) || 0;
  const gamblingSpend = Number(gamblingRisk.gamblingSpend.value ?? 0) || 0;
  const netIncome = Math.max(0, grossIncome - monthlyCommitments);
  const disposableIncome = Math.max(0, netIncome - gamblingSpend);
  const affordabilityScore = clamp(
    Math.round(
      Math.max(0, (grossIncome > 0 ? (disposableIncome / grossIncome) * 100 : 0)) +
        Math.max(0, salary.salaryConsistency.value ? Number(salary.salaryConsistency.value) * 0.15 : 0) -
        (gamblingRisk.riskLevel === "CRITICAL" ? 25 : gamblingRisk.riskLevel === "HIGH" ? 15 : gamblingRisk.riskLevel === "MEDIUM" ? 8 : 0),
    ),
  );
  const maxAffordableInstalment = clamp(Math.min(disposableIncome * 0.35, grossIncome * 0.25));
  const starterVehicle = `Starter vehicle band up to R ${Math.round(maxAffordableInstalment * 6)}`;
  const midRangeVehicle = `Mid-range vehicle band up to R ${Math.round(maxAffordableInstalment * 12)}`;
  const premiumVehicle = `Premium vehicle band above R ${Math.round(maxAffordableInstalment * 12)}`;

  const sourceText = [salary.averageSalary.sourceText, commitments.totalMonthlyCommitments.sourceText, gamblingRisk.gamblingSpend.sourceText]
    .filter(Boolean)
    .join(" | ");

  return {
    grossIncome: field(grossIncome, salary.averageSalary.confidence, sourceText),
    netIncome: field(netIncome, commitments.totalMonthlyCommitments.confidence, sourceText),
    monthlyCommitments: field(monthlyCommitments, commitments.totalMonthlyCommitments.confidence, sourceText),
    disposableIncome: field(disposableIncome, salary.averageSalary.confidence, sourceText),
    affordabilityScore: field(affordabilityScore, affordabilityScore, sourceText),
    maxAffordableInstalment: field(maxAffordableInstalment, affordabilityScore, sourceText),
    starterVehicle: field(starterVehicle, affordabilityScore, sourceText),
    midRangeVehicle: field(midRangeVehicle, affordabilityScore, sourceText),
    premiumVehicle: field(premiumVehicle, affordabilityScore, sourceText),
  };
}
