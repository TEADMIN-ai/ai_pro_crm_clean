import type {
  VehicleFinanceDriverLicenceField,
  VehicleFinanceDriverLicenceStructuredExtraction,
} from "@/types/vehicleFinance";

export type DriverLicenceExtraction = {
  name: string | null;
  surname: string | null;
  idNumber: string | null;
  licenceNumber: string | null;
  dateOfBirth: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceCode: string | null;
  gender: string | null;
  restriction: string | null;
  country: string | null;
  confidence: number;
  fieldConfidence?: Partial<
    Record<
      "name" | "surname" | "idNumber" | "licenceNumber" | "dateOfBirth" | "issueDate" | "expiryDate" | "licenceCode" | "gender" | "restriction" | "country",
      number
    >
  >;
  fields?: VehicleFinanceDriverLicenceStructuredExtraction;
};

type FieldName =
  | "name"
  | "surname"
  | "idNumber"
  | "licenceNumber"
  | "dateOfBirth"
  | "issueDate"
  | "expiryDate"
  | "licenceCode"
  | "gender"
  | "restriction"
  | "country";

type Candidate<T extends string = string> = {
  value: T;
  confidence: number;
  source: string;
  sourceText?: string;
};

type DateRangeCandidate = {
  value: {
    issueDate: string;
    expiryDate: string;
  };
  confidence: number;
  source: string;
  sourceText?: string;
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

function compactWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").trim();
}

function splitLines(text: string): string[] {
  return normalizeText(text)
    .split("\n")
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
}

function lineKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isNoiseLine(line: string): boolean {
  const key = lineKey(line);
  if (!key) {
    return true;
  }

  return [
    "drivinglicence",
    "driverslicence",
    "cartadeconducao",
    "carta",
    "condu",
    "southafrica",
    "restriction",
    "female",
    "male",
    "valid",
    "from",
    "issuedate",
    "expirydate",
    "licenceno",
    "licencenumber",
    "idno",
    "idnumber",
    "identitynumber",
    "code",
  ].some((noise) => key === noise || key.includes(noise));
}

function firstMatchingLine(lines: string[], patterns: RegExp[]): Candidate<string> | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const value = compactWhitespace(match[1]);
        if (value) {
          return { value, confidence: 95, source: pattern.source, sourceText: line };
        }
      }
    }
  }

  return null;
}

function extractJoinedRangeDates(text: string): DateRangeCandidate | null {
  const compact = compactWhitespace(text).replace(/\s+/g, " ");
  const rangePattern =
    /(?:valid\s+from|valid\s+to|valid\s+until|issued\s+on|issue(?:d)?\s+date|date\s+of\s+issue|date\s+of\s+expiry|expiry\s+date|expiry|expires?\s+on|valid)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})(?:\s*(?:-|to|until|through|thru|until)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2}))?/i;
  const match = compact.match(rangePattern);
  if (match?.[1] && match[2]) {
    return {
      value: {
        issueDate: compactWhitespace(match[1]),
        expiryDate: compactWhitespace(match[2]),
      },
      confidence: 92,
      source: rangePattern.source,
      sourceText: compactWhitespace(match[0]),
    };
  }

  const expiryOnlyPattern =
    /(?:valid\s+to|valid\s+until|expiry\s+date|date\s+of\s+expiry|expires?\s+on)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})/i;
  const expiryOnlyMatch = compact.match(expiryOnlyPattern);
  if (expiryOnlyMatch?.[1]) {
    return {
      value: {
        issueDate: "",
        expiryDate: compactWhitespace(expiryOnlyMatch[1]),
      },
      confidence: 90,
      source: expiryOnlyPattern.source,
      sourceText: compactWhitespace(expiryOnlyMatch[0]),
    };
  }

  const issueOnlyPattern =
    /(?:valid\s+from|issue(?:d)?\s+date|date\s+of\s+issue|issued\s+on)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})/i;
  const issueOnlyMatch = compact.match(issueOnlyPattern);
  if (issueOnlyMatch?.[1]) {
    return {
      value: {
        issueDate: compactWhitespace(issueOnlyMatch[1]),
        expiryDate: "",
      },
      confidence: 90,
      source: issueOnlyPattern.source,
      sourceText: compactWhitespace(issueOnlyMatch[0]),
    };
  }

  if (!match?.[1]) {
    const bareRange = compact.match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})\s*-\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})/i);
    if (!bareRange?.[1] || !bareRange[2]) {
      return null;
    }

    return {
      value: {
        issueDate: compactWhitespace(bareRange[1]),
        expiryDate: compactWhitespace(bareRange[2]),
      },
      confidence: 88,
      source: "bare_date_range",
      sourceText: compactWhitespace(bareRange[0]),
    };
  }

  return {
    value: {
      issueDate: compactWhitespace(match[1]),
      expiryDate: compactWhitespace(match[2] ?? ""),
    },
    confidence: match[2] ? 92 : 86,
    source: rangePattern.source,
    sourceText: compactWhitespace(match[0]),
  };
}

function extractStandaloneDate(text: string, patterns: RegExp[]): Candidate<string> | null {
  const lines = splitLines(text);
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        return {
          value: compactWhitespace(match[1]),
          confidence: 90,
          source: pattern.source,
          sourceText: line,
        };
      }
    }
  }
  return null;
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function normalizeLicenceDigits(value: string): string {
  if (value.length === 13 && value.startsWith("0")) {
    return value.slice(1);
  }

  return value;
}

function extractIdNumber(lines: string[], text: string): Candidate<string> | null {
  const labelled = firstMatchingLine(lines, [
    /^\s*(?:id|identity)\s*(?:no\.?|number)?\s*[:.\-]?\s*([0-9][0-9\s-]{5,20})$/i,
  ]);
  if (labelled) {
    const digits = normalizeDigits(labelled.value);
    if (digits.length >= 8 && digits.length <= 15) {
      return { value: digits, confidence: 95, source: labelled.source, sourceText: labelled.sourceText ?? labelled.value };
    }
  }

  const compact = compactWhitespace(text).replace(/\s+/g, " ");
  const pattern = /\b(?:id|identity)\s*(?:no\.?|number)?\s*[:.\-]?\s*([0-9][0-9\s-]{5,20})\b/i;
  const match = compact.match(pattern);
  if (match?.[1]) {
    const digits = normalizeDigits(match[1]);
    if (digits.length >= 8 && digits.length <= 15) {
      return { value: digits, confidence: 90, source: pattern.source, sourceText: compactWhitespace(match[0]) };
    }
  }

  const fallbackDigits = compact.match(/\b\d{8,15}\b/)?.[0];
  if (fallbackDigits) {
    return { value: fallbackDigits, confidence: 72, source: "fallback_digits", sourceText: compact };
  }

  return null;
}

function extractLicenceCode(lines: string[], text: string): Candidate<string> | null {
  const labelled = firstMatchingLine(lines, [
    /^\s*(?:licen[cs]e|driver\s+licen[cs]e)\s*(?:code|class|no\.?)\s*[:.\-]?\s*([A-Za-z0-9]+)$/i,
    /^\s*(?:code|class)\s*[:.\-]?\s*([A-Za-z0-9]{1,3})$/i,
    /^\s*(?:code)\s*[:.\-]?\s*([A-Za-z0-9]+)$/i,
  ]);
  if (labelled) {
    return { value: labelled.value, confidence: 94, source: labelled.source, sourceText: labelled.sourceText ?? labelled.value };
  }

  const linesWithLicence = lines.filter((line) => /licen[cs]e/i.test(line));
  for (const line of linesWithLicence) {
    const shortNumber = line.match(/\b(?:no\.?|class|code)\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
    if (shortNumber) {
      return { value: shortNumber.trim(), confidence: 82, source: "licence_line_short_number", sourceText: line };
    }
  }

  const explicitSingleDigit = compactWhitespace(text).match(/\blicen[cs]e\s+no\.?\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
  if (explicitSingleDigit) {
    return { value: explicitSingleDigit.trim(), confidence: 80, source: "licence_no_short_value", sourceText: compactWhitespace(text) };
  }

  const standaloneCode = compactWhitespace(text).match(/\bno\.?\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
  if (standaloneCode) {
    return { value: standaloneCode.trim(), confidence: 70, source: "standalone_code", sourceText: compactWhitespace(text) };
  }

  return null;
}

function extractLicenceNumber(lines: string[], text: string, idNumber?: string | null): Candidate<string> | null {
  const labelled = firstMatchingLine(lines, [
    /^\s*(?:dl\s*)?card\s*(?:no\.?|number)?\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\s-]{3,20})$/i,
    /^\s*(?:licen[cs]e|driver\s+licen[cs]e)\s*(?:number|no\.?|num\.?)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\s-]{3,20})$/i,
  ]);
  if (labelled) {
    const cleaned = compactWhitespace(labelled.value).replace(/[^A-Za-z0-9]/g, "");
    const digits = normalizeDigits(labelled.value);
    if (/[A-Za-z]/.test(cleaned)) {
      return { value: cleaned, confidence: 95, source: labelled.source, sourceText: labelled.sourceText ?? labelled.value };
    }

    if (digits.length >= 6) {
      return { value: normalizeLicenceDigits(digits), confidence: 95, source: labelled.source, sourceText: labelled.sourceText ?? labelled.value };
    }

    if (cleaned) {
      return { value: cleaned, confidence: 88, source: labelled.source, sourceText: labelled.sourceText ?? labelled.value };
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const digitsOnly = normalizeDigits(line);
    if (digitsOnly.length < 6 || digitsOnly.length > 15) {
      continue;
    }

    if (/^\s*(?:valid\s+from|valid\s+to|valid\s+until|issue(?:d)?\s+date|date\s+of\s+issue|date\s+of\s+expiry|expiry\s+date|expires?\s+on|dob|date\s+of\s+birth)\b/i.test(line)) {
      continue;
    }

    if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}$/.test(line.trim())) {
      continue;
    }

    const previous = lines[index - 1] ?? "";
    const next = lines[index + 1] ?? "";
    const context = `${previous} ${line} ${next}`.toLowerCase();
    if (/\bid\b|\bidentity\b/.test(context)) {
      continue;
    }

    if (/\bvalid\s+(from|to|until)\b/.test(context) || /\bissue(?:d)?\s+date\b/.test(context) || /\bexpiry\s+date\b/.test(context) || /\bdate\s+of\s+(issue|expiry|birth)\b/.test(context)) {
      continue;
    }

    if (/\brestriction\b/.test(context) || /\blicen[cs]e\b/.test(context) || /\bvalid\b/.test(context)) {
      return { value: normalizeLicenceDigits(digitsOnly), confidence: 92, source: "contextual_digit_line", sourceText: line };
    }

    if (digitsOnly.length >= 8) {
      return { value: digitsOnly, confidence: 76, source: "standalone_digit_line", sourceText: line };
    }
  }

  const compact = compactWhitespace(text).replace(/\s+/g, " ");
  const digitCandidates = compact
    .match(/\b\d[0-9\s-]{5,20}\b/g)
    ?.map((candidate) => normalizeDigits(candidate))
    .filter((candidate) => candidate.length >= 6 && candidate.length <= 15 && candidate !== idNumber) ?? [];
  if (digitCandidates.length > 0) {
    const best = digitCandidates.sort((left, right) => right.length - left.length)[0];
    return { value: normalizeLicenceDigits(best), confidence: 70, source: "digit_candidate", sourceText: compact };
  }

  return null;
}

function extractNameAndSurname(lines: string[]): { name: Candidate<string> | null; surname: Candidate<string> | null } {
  const explicitName = firstMatchingLine(lines, [
    /^\s*(?:name|given\s+names?)\s*[:.\-]?\s*([A-Za-z][A-Za-z'’\- ]{1,})$/i,
  ]);
  const explicitSurname = firstMatchingLine(lines, [
    /^\s*(?:surname|family\s+name)\s*[:.\-]?\s*([A-Za-z][A-Za-z'’\- ]{1,})$/i,
  ]);

  if (explicitName || explicitSurname) {
    return {
      name: explicitName ? { ...explicitName, confidence: 95 } : null,
      surname: explicitSurname ? { ...explicitSurname, confidence: 95 } : null,
    };
  }

  const candidateLines = lines.filter((line) => {
    if (isNoiseLine(line)) {
      return false;
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 4) {
      return false;
    }

    const letterCount = (line.match(/[A-Za-z]/g) ?? []).length;
    const digitCount = (line.match(/\d/g) ?? []).length;
    if (digitCount > 0 || letterCount < 4) {
      return false;
    }

    return true;
  });

  const candidate = candidateLines.sort((left, right) => {
    const leftScore = (left.match(/[A-Za-z]/g) ?? []).length - (left.match(/\d/g) ?? []).length;
    const rightScore = (right.match(/[A-Za-z]/g) ?? []).length - (right.match(/\d/g) ?? []).length;
    return rightScore - leftScore;
  })[0];
  if (!candidate) {
    return { name: null, surname: null };
  }

  const parts = candidate.split(/\s+/).filter(Boolean);
  const name = parts.length >= 3 ? parts.slice(0, parts.length - 1).join(" ") : parts[0] ?? null;
  const surname = parts.length >= 2 ? parts[parts.length - 1] : null;

  return {
    name: name ? { value: name, confidence: 78, source: "heuristic_name_line", sourceText: candidate } : null,
    surname: surname ? { value: surname, confidence: 78, source: "heuristic_name_line", sourceText: candidate } : null,
  };
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildConfidenceMap(entries: Array<[FieldName, Candidate<string> | null]>): Partial<Record<FieldName, number>> {
  const result: Partial<Record<FieldName, number>> = {};
  for (const [field, candidate] of entries) {
    if (candidate) {
      result[field] = clamp(candidate.confidence);
    }
  }
  return result;
}

function pickSourceText(candidate: Candidate<string> | null | undefined, fallback: string): string {
  return compactWhitespace(candidate?.sourceText ?? candidate?.value ?? fallback);
}

function toFieldEvidence(value: string | null, confidence: number, sourceText: string): VehicleFinanceDriverLicenceField {
  return {
    value,
    confidence: clamp(confidence),
    sourceText: compactWhitespace(sourceText),
  };
}

function extractLabelledValue(lines: string[], labels: RegExp[], confidence = 95): Candidate<string> | null {
  const labelled = firstMatchingLine(lines, labels);
  if (labelled) {
    return { ...labelled, confidence };
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labels.some((pattern) => pattern.test(line))) {
      continue;
    }

    const next = lines[index + 1] ?? "";
    if (next) {
      return {
        value: next,
        confidence: Math.max(70, confidence - 10),
        source: "next_line",
        sourceText: `${line} ${next}`,
      };
    }
  }

  return null;
}

function extractGender(lines: string[]): Candidate<string> | null {
  for (const line of lines) {
    const match = line.match(/\b(MALE|FEMALE)\b/i);
    if (match?.[1]) {
      return {
        value: match[1].toUpperCase(),
        confidence: 98,
        source: "gender_line",
        sourceText: line,
      };
    }
  }

  return null;
}

function isDateLike(value: string): boolean {
  return /(?:\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b\d{4}[\/.-]\d{2}[\/.-]\d{2}\b)/.test(value);
}

function extractDateOfBirth(lines: string[], text: string): Candidate<string> | null {
  const labelled = extractStandaloneDate(text, [
    /^\s*(?:dob|date\s+of\s+birth|birth\s+date)\s*[:.\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})$/i,
  ]);
  if (labelled) {
    return { ...labelled, confidence: 95 };
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isDateLike(line)) {
      continue;
    }

    if (/^\s*(?:valid\s+from|valid\s+to|valid\s+until|issue(?:d)?\s+date|date\s+of\s+issue|date\s+of\s+expiry|expiry\s+date|expires?\s+on)\b/i.test(line)) {
      continue;
    }

    const previous = lines[index - 1] ?? "";
    const next = lines[index + 1] ?? "";
    const context = `${previous} ${line} ${next}`.toLowerCase();
    if (/(female|male|sex|gender|id|identity|restriction|surname|name|birth)/.test(context)) {
      return {
        value: compactWhitespace(line),
        confidence: /dob|birth/.test(context) ? 92 : 88,
        source: "contextual_dob_line",
        sourceText: line,
      };
    }
  }

  return null;
}

function extractRestriction(lines: string[]): Candidate<string> | null {
  const labelled = extractLabelledValue(lines, [
    /^\s*restrictions?\s*[:.\-]?\s*([A-Za-z0-9]+)$/i,
  ], 95);
  if (labelled) {
    const cleaned = compactWhitespace(labelled.value).replace(/[^A-Za-z0-9]/g, "");
    if (cleaned) {
      return { ...labelled, value: cleaned };
    }
  }

  for (const line of lines) {
    if (/^\s*restrictions?\b/i.test(line)) {
      const nextDigits = line.match(/restrictions?\s*[:.\-]?\s*([A-Za-z0-9]+)/i)?.[1];
      if (nextDigits) {
        return {
          value: nextDigits.replace(/[^A-Za-z0-9]/g, ""),
          confidence: 95,
          source: "restriction_inline",
          sourceText: line,
        };
      }
    }
  }

  return null;
}

function extractCountry(lines: string[]): Candidate<string> | null {
  for (const line of lines) {
    if (/south\s+africa/i.test(line)) {
      return {
        value: "SOUTH AFRICA",
        confidence: 98,
        source: "country_indicator",
        sourceText: line,
      };
    }
  }

  for (const line of lines) {
    if (/\bza\b/i.test(line)) {
      return {
        value: "ZA",
        confidence: 88,
        source: "country_indicator",
        sourceText: line,
      };
    }
  }

  return null;
}

export function extractDriverLicenceDetails(text: string): DriverLicenceExtraction {
  try {
    const normalized = normalizeText(text);
    const lines = splitLines(normalized);
    const { name, surname } = extractNameAndSurname(lines);
    const idNumber = extractIdNumber(lines, normalized);
    const licenceCode = extractLicenceCode(lines, normalized);
    const licenceNumber = extractLicenceNumber(lines, normalized, idNumber?.value ?? null);
  const gender = extractGender(lines);
  const restriction = extractRestriction(lines);
  const country = extractCountry(lines);
  const dateOfBirth = extractDateOfBirth(lines, normalized);
  const rangeDates = extractJoinedRangeDates(normalized);
  const standaloneIssueDate = extractStandaloneDate(normalized, [
    /^\s*(?:issue(?:d)?\s+date|date\s+of\s+issue|valid\s+from)\s*[:.\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})$/i,
    ]);
    const standaloneExpiryDate = extractStandaloneDate(normalized, [
      /^\s*(?:expiry\s+date|date\s+of\s+expiry|valid\s+to|valid\s+until|expires?\s+on)\s*[:.\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})$/i,
    ]);

    const issueDate = standaloneIssueDate?.value ?? (rangeDates?.value.issueDate || null);
    const expiryDate = standaloneExpiryDate?.value ?? (rangeDates?.value.expiryDate || null);

    const fieldConfidence = buildConfidenceMap([
      ["name", name],
      ["surname", surname],
      ["idNumber", idNumber],
      ["licenceNumber", licenceNumber],
      ["issueDate", issueDate ? { value: issueDate, confidence: standaloneIssueDate?.confidence ?? rangeDates?.confidence ?? 90, source: "date", sourceText: standaloneIssueDate?.sourceText ?? rangeDates?.sourceText } : null],
      ["expiryDate", expiryDate ? { value: expiryDate, confidence: standaloneExpiryDate?.confidence ?? rangeDates?.confidence ?? 90, source: "date", sourceText: standaloneExpiryDate?.sourceText ?? rangeDates?.sourceText } : null],
      ["licenceCode", licenceCode],
      ["dateOfBirth", dateOfBirth],
      ["gender", gender],
      ["restriction", restriction],
      ["country", country],
    ]);

    const confidenceSignals = [
      fieldConfidence.name ?? 0,
      fieldConfidence.surname ?? 0,
      fieldConfidence.idNumber ?? 0,
      fieldConfidence.licenceNumber ?? 0,
      fieldConfidence.issueDate ?? 0,
      fieldConfidence.expiryDate ?? 0,
      fieldConfidence.licenceCode ?? 0,
      fieldConfidence.gender ?? 0,
      fieldConfidence.restriction ?? 0,
      fieldConfidence.country ?? 0,
      fieldConfidence.dateOfBirth ?? 0,
    ].filter((value) => value > 0);

    const weightedConfidence = clamp(
      average(
        confidenceSignals.map((value, index) => {
          if (index === 0 || index === 1) {
            return value * 0.85;
          }
          if (index === 4 || index === 5) {
            return value * 0.95;
          }
          if (index === 2 || index === 3 || index === 6) {
            return value * 1;
          }
          return value * 0.9;
        }),
      ) || 0,
    );

    const fieldSourceText = {
      name: pickSourceText(name, name?.value ?? ""),
      surname: pickSourceText(surname, surname?.value ?? ""),
      idNumber: pickSourceText(idNumber, idNumber?.value ?? ""),
      licenceNumber: pickSourceText(licenceNumber, licenceNumber?.value ?? ""),
      issueDate: pickSourceText(standaloneIssueDate, rangeDates?.sourceText ?? issueDate ?? ""),
      expiryDate: pickSourceText(standaloneExpiryDate, rangeDates?.sourceText ?? expiryDate ?? ""),
      licenceCode: pickSourceText(licenceCode, licenceCode?.value ?? ""),
      gender: pickSourceText(gender, gender?.value ?? ""),
      restriction: pickSourceText(restriction, restriction?.value ?? ""),
      country: pickSourceText(country, country?.value ?? ""),
      dateOfBirth: pickSourceText(dateOfBirth, dateOfBirth?.value ?? ""),
    };

    const fields = {
      name: toFieldEvidence(name?.value ?? null, fieldConfidence.name ?? name?.confidence ?? 0, fieldSourceText.name),
      surname: toFieldEvidence(surname?.value ?? null, fieldConfidence.surname ?? surname?.confidence ?? 0, fieldSourceText.surname),
      idNumber: toFieldEvidence(idNumber?.value ?? null, fieldConfidence.idNumber ?? idNumber?.confidence ?? 0, fieldSourceText.idNumber),
      licenceNumber: toFieldEvidence(licenceNumber?.value ?? null, fieldConfidence.licenceNumber ?? licenceNumber?.confidence ?? 0, fieldSourceText.licenceNumber),
      dateOfBirth: toFieldEvidence(dateOfBirth?.value ?? null, fieldConfidence.dateOfBirth ?? dateOfBirth?.confidence ?? 0, fieldSourceText.dateOfBirth),
      issueDate: toFieldEvidence(issueDate, fieldConfidence.issueDate ?? standaloneIssueDate?.confidence ?? 0, fieldSourceText.issueDate),
      expiryDate: toFieldEvidence(expiryDate, fieldConfidence.expiryDate ?? standaloneExpiryDate?.confidence ?? 0, fieldSourceText.expiryDate),
      licenceCode: toFieldEvidence(licenceCode?.value ?? null, fieldConfidence.licenceCode ?? licenceCode?.confidence ?? 0, fieldSourceText.licenceCode),
      gender: toFieldEvidence(gender?.value ?? null, fieldConfidence.gender ?? gender?.confidence ?? 0, fieldSourceText.gender),
      restriction: toFieldEvidence(restriction?.value ?? null, fieldConfidence.restriction ?? restriction?.confidence ?? 0, fieldSourceText.restriction),
      country: toFieldEvidence(country?.value ?? null, fieldConfidence.country ?? country?.confidence ?? 0, fieldSourceText.country),
    } satisfies VehicleFinanceDriverLicenceStructuredExtraction;

    return {
      name: name?.value ?? null,
      surname: surname?.value ?? null,
      idNumber: idNumber?.value ?? null,
      licenceNumber: licenceNumber?.value ?? null,
      dateOfBirth: dateOfBirth?.value ?? null,
      issueDate,
      expiryDate,
      licenceCode: licenceCode?.value ?? null,
      gender: gender?.value ?? null,
      restriction: restriction?.value ?? null,
      country: country?.value ?? null,
      confidence: weightedConfidence,
      fieldConfidence,
      fields,
    };
  } catch {
    return {
      name: null,
      surname: null,
      idNumber: null,
      licenceNumber: null,
      dateOfBirth: null,
      issueDate: null,
      expiryDate: null,
      licenceCode: null,
      gender: null,
      restriction: null,
      country: null,
      confidence: 0,
      fieldConfidence: {},
      fields: {
        name: toFieldEvidence(null, 0, ""),
        surname: toFieldEvidence(null, 0, ""),
        idNumber: toFieldEvidence(null, 0, ""),
        licenceNumber: toFieldEvidence(null, 0, ""),
        dateOfBirth: toFieldEvidence(null, 0, ""),
        issueDate: toFieldEvidence(null, 0, ""),
        expiryDate: toFieldEvidence(null, 0, ""),
        licenceCode: toFieldEvidence(null, 0, ""),
        gender: toFieldEvidence(null, 0, ""),
        restriction: toFieldEvidence(null, 0, ""),
        country: toFieldEvidence(null, 0, ""),
      },
    };
  }
}
