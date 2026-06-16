import type {
  VehicleFinancePayslipField,
  VehicleFinancePayslipLineItem,
  VehicleFinancePayslipStructuredExtraction,
} from "@/types/vehicleFinance";

export type PayslipExtraction = VehicleFinancePayslipStructuredExtraction & {
  documentType: "PAYSLIP";
  confidence: number;
  crossDocumentPreparation: {
    employeeName: VehicleFinancePayslipField;
    surname: VehicleFinancePayslipField;
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

function field(value: string | number | null, confidence: number, sourceText: string): VehicleFinancePayslipField {
  return { value, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

function lineItem(type: string, amount: number | null, confidence: number, sourceText: string): VehicleFinancePayslipLineItem {
  return { type, amount, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseAmount(value: string): number | null {
  const normalizedValue = compact(value).replace(/(\d)\s+(?=\d)/g, "$1");
  const match = normalizedValue.match(/(-?\d[\d,]*(?:\.\d{2})?)/);
  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractAmountFromLine(line: string): Candidate<number> | null {
  const amount = parseAmount(line);
  if (amount === null) {
    return null;
  }

  return {
    value: amount,
    confidence: /r\s*\d/i.test(line) ? 94 : 90,
    sourceText: line,
  };
}

function firstMatch(linesValue: string[], patterns: RegExp[]): Candidate<string> | null {
  for (const line of linesValue) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const value = compact(match[1]);
        if (value) {
          return { value, confidence: 95, sourceText: line };
        }
      }
    }
  }

  return null;
}

function valueAfterLabel(linesValue: string[], patterns: RegExp[], confidence = 95): Candidate<string> | null {
  for (let index = 0; index < linesValue.length; index += 1) {
    const line = linesValue[index];
    if (!patterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    const inline = compact(line.replace(/^.*?[:.\-]\s*/, ""));
    if (inline && !patterns.some((pattern) => pattern.test(inline))) {
      return { value: inline, confidence, sourceText: line };
    }

    const next = linesValue[index + 1] ?? "";
    if (next) {
      return { value: next, confidence: Math.max(70, confidence - 10), sourceText: `${line} ${next}` };
    }
  }

  return null;
}

function findLineIndex(linesValue: string[], patterns: RegExp[]): number {
  return linesValue.findIndex((line) => patterns.some((pattern) => pattern.test(line)));
}

function chooseEmployer(linesValue: string[]): Candidate<string> | null {
  const labelled = valueAfterLabel(linesValue, [/^\s*(?:company\s+name|employer|employer\s+name|company)\s*$/i], 96);
  if (labelled?.value) {
    return labelled;
  }

  for (const line of linesValue) {
    if (/payslip|salary|employee|gross|net|deduction|uif|paye/i.test(line)) {
      continue;
    }
    if (/[A-Za-z]/.test(line) && line.length >= 4 && line.length <= 60) {
      return { value: line, confidence: 78, sourceText: line };
    }
  }

  return null;
}

function chooseEmployeeName(linesValue: string[]): Candidate<string> | null {
  return valueAfterLabel(linesValue, [/^\s*(?:employee\s+name|employee|staff\s+name|name)\b/i], 94);
}

function chooseEmployeeNumber(linesValue: string[]): Candidate<string> | null {
  const labelled = valueAfterLabel(linesValue, [/^\s*(?:employee\s+number|employee\s+no\.?|employee\s+code|staff\s+number)\b/i], 95);
  if (labelled?.value) {
    return labelled;
  }

  for (const line of linesValue) {
    const digits = compact(line).replace(/[^\da-z]/gi, "");
    if (/(employee|staff|code|no|number)/i.test(line) && digits.length >= 3) {
      return { value: digits, confidence: 80, sourceText: line };
    }
  }

  return null;
}

function chooseDesignation(linesValue: string[]): Candidate<string> | null {
  return valueAfterLabel(linesValue, [/^\s*(?:designation|position|job\s+title|role)\b/i], 92);
}

function choosePayDate(linesValue: string[]): Candidate<string> | null {
  const candidate = valueAfterLabel(linesValue, [/^\s*(?:pay\s*date|date\s*paid|payment\s*date|paid\s*on)\b/i], 95);
  if (candidate?.value) {
    return candidate;
  }

  const periodEnding = valueAfterLabel(linesValue, [/^\s*(?:period\s*ending|month\s*ending|for\s+the\s+month\s+ended)\s*$/i], 90);
  if (periodEnding?.value) {
    return periodEnding;
  }

  for (const line of linesValue) {
    if (/\b\d{4}[-/]\d{2}[-/]\d{2}\b/.test(line) || /\b\d{2}[-/]\d{2}[-/]\d{4}\b/.test(line)) {
      if (/paid|date|period|ending/i.test(line)) {
        return { value: line, confidence: 82, sourceText: line };
      }
    }
  }

  return null;
}

function choosePayPeriod(linesValue: string[]): Candidate<string> | null {
  const labelled = valueAfterLabel(linesValue, [/^\s*(?:pay\s*period|period|period\s*of\s*employment)\b/i], 92);
  if (labelled?.value) {
    return labelled;
  }

  const rangePatterns = [
    /(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\s*(?:to|-|until|through)\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i,
    /(?:from)\s+(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\s*(?:to|-|until|through)\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i,
  ];

  for (const line of linesValue) {
    for (const pattern of rangePatterns) {
      const match = line.match(pattern);
      if (match?.[0]) {
        return { value: compact(match[0]), confidence: 88, sourceText: line };
      }
    }
  }

  return null;
}

function chooseMoney(linesValue: string[], labels: RegExp[]): Candidate<number> | null {
  for (let index = 0; index < linesValue.length; index += 1) {
    const line = linesValue[index];
    if (!labels.some((pattern) => pattern.test(line))) {
      continue;
    }

    const sameLine = extractAmountFromLine(line);
    if (sameLine) {
      return sameLine;
    }

    const next = linesValue[index + 1] ?? "";
    const nextAmount = extractAmountFromLine(next);
    if (nextAmount) {
      return { ...nextAmount, confidence: Math.max(80, nextAmount.confidence - 5), sourceText: `${line} ${next}` };
    }
  }

  return null;
}

function extractLineItems(linesValue: string[], itemLabels: Array<{ type: string; patterns: RegExp[] }>): VehicleFinancePayslipLineItem[] {
  const items: VehicleFinancePayslipLineItem[] = [];

  for (const item of itemLabels) {
    for (let index = 0; index < linesValue.length; index += 1) {
      const line = linesValue[index];
      if (!item.patterns.some((pattern) => pattern.test(line))) {
        continue;
      }

      const amount = extractAmountFromLine(line) ?? extractAmountFromLine(linesValue[index + 1] ?? "");
      items.push(
        lineItem(
          item.type,
          amount?.value ?? null,
          amount?.confidence ?? 80,
          amount?.sourceText ?? line,
        ),
      );
      break;
    }
  }

  return items;
}

function chooseEmployerFromTop(linesValue: string[]): Candidate<string> | null {
  const topLines = linesValue.slice(0, 6);
  for (const line of topLines) {
    if (/payslip|salary|employee|gross|net|deduction|uif|paye/i.test(line)) {
      continue;
    }
    if (/[A-Za-z]/.test(line) && line.length >= 4) {
      return { value: line, confidence: 82, sourceText: line };
    }
  }
  return null;
}

function buildOverallConfidence(fields: Array<VehicleFinancePayslipField>): number {
  const values = fields.map((item) => item.confidence).filter((value) => value > 0);
  if (!values.length) {
    return 0;
  }

  return clamp(average(values));
}

export function extractPayslipDetails(text: string): PayslipExtraction {
  const normalized = normalizeText(text);
  const linesValue = splitLines(normalized);

  const employerName = chooseEmployer(linesValue) ?? chooseEmployerFromTop(linesValue);
  const employeeName = chooseEmployeeName(linesValue);
  const employeeNumber = chooseEmployeeNumber(linesValue);
  const designation = chooseDesignation(linesValue);
  const grossEarnings = chooseMoney(linesValue, [
    /^\s*(?:gross\s+earnings|gross\s+salary|gross\s+pay|basic\s+salary|earnings)\b/i,
  ]);
  const totalDeductions = chooseMoney(linesValue, [
    /^\s*(?:total\s+deductions|deductions)\b/i,
  ]);
  const netPay = chooseMoney(linesValue, [
    /^\s*(?:net\s+pay|net\s+salary|take\s+home\s+pay|take-home\s+pay|net)\b/i,
  ]);
  const payDate = choosePayDate(linesValue);
  const payPeriod = choosePayPeriod(linesValue);

  const deductions = extractLineItems(linesValue, [
    { type: "PAYE", patterns: [/^\s*paye\b/i] },
    { type: "UIF", patterns: [/^\s*uif\b/i] },
    { type: "Medical Aid", patterns: [/^\s*medical\s+aid\b/i] },
    { type: "Pension", patterns: [/^\s*pension\b/i] },
    { type: "Retirement", patterns: [/^\s*retirement\b/i] },
    { type: "Other", patterns: [/^\s*other\s+deductions\b/i, /^\s*other\b/i] },
  ]);

  const benefits = extractLineItems(linesValue, [
    { type: "Medical Aid", patterns: [/^\s*medical\s+aid\b/i] },
    { type: "Pension", patterns: [/^\s*pension\b/i] },
    { type: "Provident Fund", patterns: [/^\s*provident\s+fund\b/i] },
    { type: "Employer Contributions", patterns: [/^\s*employer\s+contributions\b/i] },
  ]);

  const employerField = field(employerName?.value ?? null, employerName?.confidence ?? 0, employerName?.sourceText ?? "");
  const employeeField = field(employeeName?.value ?? null, employeeName?.confidence ?? 0, employeeName?.sourceText ?? "");
  const employeeNumberField = field(employeeNumber?.value ?? null, employeeNumber?.confidence ?? 0, employeeNumber?.sourceText ?? "");
  const designationField = field(designation?.value ?? null, designation?.confidence ?? 0, designation?.sourceText ?? "");
  const grossField = field(grossEarnings?.value ?? null, grossEarnings?.confidence ?? 0, grossEarnings?.sourceText ?? "");
  const totalDeductionsField = field(totalDeductions?.value ?? null, totalDeductions?.confidence ?? 0, totalDeductions?.sourceText ?? "");
  const netField = field(netPay?.value ?? null, netPay?.confidence ?? 0, netPay?.sourceText ?? "");
  const payDateField = field(payDate?.value ?? null, payDate?.confidence ?? 0, payDate?.sourceText ?? "");
  const payPeriodField = field(payPeriod?.value ?? null, payPeriod?.confidence ?? 0, payPeriod?.sourceText ?? "");

  const totals = [
    employerField,
    employeeField,
    employeeNumberField,
    designationField,
    grossField,
    totalDeductionsField,
    netField,
    payDateField,
    payPeriodField,
  ];

  const extractedTotalDeductions =
    totalDeductionsField.value !== null
      ? totalDeductionsField
      : deductions.length
        ? field(
            deductions.reduce((sum, item) => sum + (item.amount ?? 0), 0),
            84,
            deductions.map((item) => item.sourceText).join(" | "),
          )
        : totalDeductionsField;

  const employeeSurname = (() => {
    const fullName = typeof employeeField.value === "string" ? employeeField.value : "";
    const parts = compact(fullName).split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return field(parts[parts.length - 1], Math.max(70, employeeField.confidence - 5), employeeField.sourceText || fullName);
    }
    return field(null, 0, employeeField.sourceText || "");
  })();

  const overallConfidence = buildOverallConfidence([
    employerField,
    employeeField,
    employeeNumberField,
    designationField,
    grossField,
    extractedTotalDeductions,
    netField,
    payDateField,
    payPeriodField,
  ]);

  return {
    documentType: "PAYSLIP",
    employerName: employerField,
    employeeName: employeeField,
    employeeNumber: employeeNumberField,
    designation: designationField,
    grossEarnings: grossField,
    totalDeductions: extractedTotalDeductions,
    netPay: netField,
    payDate: payDateField,
    payPeriod: payPeriodField,
    benefits,
    deductions,
    confidence: overallConfidence,
    crossDocumentPreparation: {
      employeeName: employeeField,
      surname: employeeSurname,
    },
  };
}
