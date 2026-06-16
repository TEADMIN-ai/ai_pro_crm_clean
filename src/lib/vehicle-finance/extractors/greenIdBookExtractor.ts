import type {
  VehicleFinanceIdentityField,
  VehicleFinanceIdentityStructuredExtraction,
} from "@/types/vehicleFinance";

export type GreenIdBookExtraction = VehicleFinanceIdentityStructuredExtraction & {
  documentType: "GREEN_ID_BOOK";
  integrityIndicators: {
    photoDetected: boolean;
    barcodeDetected: boolean;
    cardNumberDetected: boolean;
  };
  confidence: number;
};

type Candidate<T extends string = string> = {
  value: T;
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

function labelled(linesValue: string[], labels: RegExp[], nextLine = false): Candidate | null {
  for (let index = 0; index < linesValue.length; index += 1) {
    const line = linesValue[index];
    if (labels.some((pattern) => pattern.test(line))) {
      const match = line.match(/[:.\-]?\s*(.+)$/);
      const inline = match?.[1] ? compact(match[1]) : "";
      if (inline && !labels.some((pattern) => pattern.test(inline))) {
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
  const candidates = [
    labelled(linesValue, [/^\s*i\.?d\.?\s*no\.?\s*$/i, /^\s*id\s+number\s*$/i], true),
    labelled(linesValue, [/^\s*i\.?d\.?\s*no\.?\s*[:.\-]\s*/i, /^\s*id\s+number\s*[:.\-]\s*/i]),
  ].filter(Boolean) as Candidate[];

  for (const candidate of candidates) {
    const digits = compact(candidate.value).replace(/[^\d]/g, "");
    if (digits.length >= 12) {
      return { value: digits, confidence: 98, sourceText: candidate.sourceText };
    }
  }

  const flattened = compact(linesValue.join(" "));
  const match = flattened.match(/\b\d{13}\b/);
  if (match?.[0]) {
    return { value: match[0], confidence: 94, sourceText: match[0] };
  }

  return null;
}

function extractNameField(linesValue: string[], labels: RegExp[]): Candidate | null {
  const candidate = labelled(linesValue, labels, true);
  if (candidate?.value) {
    return { ...candidate, confidence: 94 };
  }
  return null;
}

function extractDate(linesValue: string[], labels: RegExp[]): Candidate | null {
  const candidate = labelled(linesValue, labels, true);
  const value = candidate?.value ?? "";
  const match = value.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/);
  if (match?.[1]) {
    return { value: match[1], confidence: 92, sourceText: candidate?.sourceText ?? match[1] };
  }
  return null;
}

function extractCitizenship(linesValue: string[]): Candidate | null {
  const joined = compact(linesValue.join(" "));
  if (/sa\s+citizen/i.test(joined)) {
    return { value: "SA CITIZEN", confidence: 98, sourceText: "SA CITIZEN" };
  }
  if (/south\s+africa/i.test(joined)) {
    return { value: "SOUTH AFRICA", confidence: 96, sourceText: "SOUTH AFRICA" };
  }
  return null;
}

function extractCountryOfBirth(linesValue: string[]): Candidate | null {
  const candidate = labelled(linesValue, [/^\s*country\s+of\s+birth\s*$/i], true);
  if (candidate?.value) {
    return { value: compact(candidate.value).toUpperCase(), confidence: 97, sourceText: candidate.sourceText };
  }
  return null;
}

function detectIntegrity(text: string, linesValue: string[]): GreenIdBookExtraction["integrityIndicators"] {
  const flattened = compact(text);
  return {
    photoDetected: /photo|picture|face/i.test(flattened),
    barcodeDetected: /barcode|bar\s*code|\|\s*\|\s*\|/i.test(flattened),
    cardNumberDetected: /card\s*(?:no|number)|issue\s*number/i.test(flattened),
  };
}

function buildOverallConfidence(fields: Array<VehicleFinanceIdentityField>): number {
  const values = fields.map((fieldValue) => fieldValue.confidence).filter((value) => value > 0);
  if (!values.length) {
    return 0;
  }
  return clamp((values.reduce((sum, value) => sum + value, 0) / values.length) * 1.02);
}

export function extractGreenIdBookDetails(text: string): GreenIdBookExtraction {
  const input = normalizeText(text);
  const linesValue = lines(input);

  const idNumber = extractIdNumber(linesValue);
  const surname = extractNameField(linesValue, [/^\s*surname\s*$/i]);
  const forenames = extractNameField(linesValue, [/^\s*forenames\s*$/i]);
  const countryOfBirth = extractCountryOfBirth(linesValue);
  const dateOfBirth = extractDate(linesValue, [/^\s*date\s+of\s+birth\s*$/i]);
  const dateIssued = extractDate(linesValue, [/^\s*date\s+issued\s*$/i]);
  const citizenship = extractCitizenship(linesValue);

  const fields = {
    idNumber: field(idNumber?.value ?? null, idNumber?.confidence ?? 0, idNumber?.sourceText ?? ""),
    surname: field(surname?.value ?? null, surname?.confidence ?? 0, surname?.sourceText ?? ""),
    forenames: field(forenames?.value ?? null, forenames?.confidence ?? 0, forenames?.sourceText ?? ""),
    dateOfBirth: field(dateOfBirth?.value ?? null, dateOfBirth?.confidence ?? 0, dateOfBirth?.sourceText ?? ""),
    countryOfBirth: field(countryOfBirth?.value ?? null, countryOfBirth?.confidence ?? 0, countryOfBirth?.sourceText ?? ""),
    citizenship: field(citizenship?.value ?? null, citizenship?.confidence ?? 0, citizenship?.sourceText ?? ""),
    dateIssued: field(dateIssued?.value ?? null, dateIssued?.confidence ?? 0, dateIssued?.sourceText ?? ""),
    issueNumber: field(null, 0, ""),
    gender: field(null, 0, ""),
  };

  return {
    documentType: "GREEN_ID_BOOK",
    ...fields,
    integrityIndicators: detectIntegrity(input, linesValue),
    confidence: buildOverallConfidence([
      fields.idNumber,
      fields.surname,
      fields.forenames,
      fields.dateOfBirth,
      fields.countryOfBirth,
      fields.citizenship,
      fields.dateIssued,
    ]),
  };
}
