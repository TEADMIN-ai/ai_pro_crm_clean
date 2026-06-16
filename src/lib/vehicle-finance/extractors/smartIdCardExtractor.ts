import type {
  VehicleFinanceIdentityField,
  VehicleFinanceIdentityStructuredExtraction,
} from "@/types/vehicleFinance";

export type SmartIdCardExtraction = VehicleFinanceIdentityStructuredExtraction & {
  documentType: "SMART_ID_CARD";
  integrityIndicators: {
    photoDetected: boolean;
    barcodeDetected: boolean;
    cardNumberDetected: boolean;
  };
  confidence: number;
};

type Candidate = {
  value: string;
  confidence: number;
  sourceText: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string): string {
  return (value ?? "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\r/g, "\n");
}

function compact(value: string): string {
  return value.replace(/[ \t]+/g, " ").trim();
}

function lines(text: string): string[] {
  return normalizeText(text)
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean);
}

function field(value: string | null, confidence: number, sourceText: string): VehicleFinanceIdentityField {
  return { value, confidence: clamp(confidence), sourceText: compact(sourceText) };
}

function findLabel(linesValue: string[], patterns: RegExp[], nextLine = false): Candidate | null {
  for (let index = 0; index < linesValue.length; index += 1) {
    const line = linesValue[index];
    if (patterns.some((pattern) => pattern.test(line))) {
      const inline = compact(line.replace(/^.*?[:.\-]\s*/, ""));
      if (inline && !patterns.some((pattern) => pattern.test(inline))) {
        return { value: inline, confidence: 95, sourceText: line };
      }
      if (nextLine) {
        const next = linesValue[index + 1] ?? "";
        if (next) {
          return { value: next, confidence: 90, sourceText: `${line} ${next}` };
        }
      }
    }
  }
  return null;
}

function extractIdNumber(linesValue: string[]): Candidate | null {
  const label = findLabel(linesValue, [/^\s*identity\s+number\s*$/i, /^\s*i\.?d\.?\s*no\.?\s*$/i], true);
  if (label?.value) {
    const digits = compact(label.value).replace(/[^\d]/g, "");
    if (digits.length >= 12) {
      return { value: digits, confidence: 98, sourceText: label.sourceText };
    }
  }

  const flattened = compact(linesValue.join(" "));
  const match = flattened.match(/\b\d{13}\b/);
  if (match?.[0]) {
    return { value: match[0], confidence: 94, sourceText: match[0] };
  }

  return null;
}

function extractNames(linesValue: string[]): { surname: Candidate | null; names: Candidate | null } {
  const surname = findLabel(linesValue, [/^\s*surname\s*$/i], true);
  const names = findLabel(linesValue, [/^\s*names\s*$/i, /^\s*forenames\s*$/i], true);
  return {
    surname: surname?.value ? { ...surname, confidence: 94 } : null,
    names: names?.value ? { ...names, confidence: 94 } : null,
  };
}

function extractGender(linesValue: string[]): Candidate | null {
  for (const line of linesValue) {
    const match = line.match(/\b(MALE|FEMALE)\b/i);
    if (match?.[1]) {
      return { value: match[1].toUpperCase(), confidence: 98, sourceText: line };
    }
  }
  return null;
}

function extractDateOfBirth(linesValue: string[]): Candidate | null {
  const label = findLabel(linesValue, [/^\s*date\s+of\s+birth\s*$/i], true);
  if (label?.value) {
    const match = label.value.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/);
    if (match?.[1]) {
      return { value: match[1], confidence: 92, sourceText: label.sourceText };
    }
  }
  return null;
}

function extractIssueNumber(linesValue: string[]): Candidate | null {
  const label = findLabel(linesValue, [/^\s*issue\s+number\s*$/i], true);
  if (label?.value) {
    return { value: compact(label.value), confidence: 90, sourceText: label.sourceText };
  }
  const match = compact(linesValue.join(" ")).match(/\bissue\s+number\s*[:.\-]?\s*([A-Za-z0-9\-]+)\b/i);
  if (match?.[1]) {
    return { value: match[1], confidence: 90, sourceText: match[0] };
  }
  return null;
}

function extractCitizenship(linesValue: string[]): Candidate | null {
  const joined = compact(linesValue.join(" "));
  if (/south\s+africa/i.test(joined)) {
    return { value: "SOUTH AFRICA", confidence: 98, sourceText: "SOUTH AFRICA" };
  }
  if (/\bsa\s+citizen\b/i.test(joined)) {
    return { value: "SA CITIZEN", confidence: 96, sourceText: "SA CITIZEN" };
  }
  return null;
}

function detectIntegrity(text: string): SmartIdCardExtraction["integrityIndicators"] {
  const flattened = compact(text);
  return {
    photoDetected: /photo|picture|face/i.test(flattened),
    barcodeDetected: /barcode|bar\s*code|\|\s*\|\s*\|/i.test(flattened),
    cardNumberDetected: /card\s*(?:no|number)|issue\s*number/i.test(flattened),
  };
}

function buildOverallConfidence(fields: Array<VehicleFinanceIdentityField>): number {
  const values = fields.map((fieldValue) => fieldValue.confidence).filter((value) => value > 0);
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function extractSmartIdCardDetails(text: string): SmartIdCardExtraction {
  const input = normalizeText(text);
  const linesValue = lines(input);
  const idNumber = extractIdNumber(linesValue);
  const { surname, names } = extractNames(linesValue);
  const gender = extractGender(linesValue);
  const dateOfBirth = extractDateOfBirth(linesValue);
  const issueNumber = extractIssueNumber(linesValue);
  const citizenship = extractCitizenship(linesValue);

  const fields = {
    idNumber: field(idNumber?.value ?? null, idNumber?.confidence ?? 0, idNumber?.sourceText ?? ""),
    surname: field(surname?.value ?? null, surname?.confidence ?? 0, surname?.sourceText ?? ""),
    forenames: field(names?.value ?? null, names?.confidence ?? 0, names?.sourceText ?? ""),
    dateOfBirth: field(dateOfBirth?.value ?? null, dateOfBirth?.confidence ?? 0, dateOfBirth?.sourceText ?? ""),
    countryOfBirth: field(null, 0, ""),
    citizenship: field(citizenship?.value ?? null, citizenship?.confidence ?? 0, citizenship?.sourceText ?? ""),
    dateIssued: field(null, 0, ""),
    issueNumber: field(issueNumber?.value ?? null, issueNumber?.confidence ?? 0, issueNumber?.sourceText ?? ""),
    gender: field(gender?.value ?? null, gender?.confidence ?? 0, gender?.sourceText ?? ""),
  };

  return {
    documentType: "SMART_ID_CARD",
    ...fields,
    integrityIndicators: detectIntegrity(input),
    confidence: buildOverallConfidence([
      fields.idNumber,
      fields.surname,
      fields.forenames,
      fields.dateOfBirth,
      fields.citizenship,
      fields.gender,
    ]),
  };
}
