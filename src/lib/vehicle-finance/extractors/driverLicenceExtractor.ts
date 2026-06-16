export type DriverLicenceExtraction = {
  name: string | null;
  surname: string | null;
  idNumber: string | null;
  licenceNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceCode: string | null;
  confidence: number;
  fieldConfidence?: Partial<Record<"name" | "surname" | "idNumber" | "licenceNumber" | "issueDate" | "expiryDate" | "licenceCode", number>>;
};

type FieldName = "name" | "surname" | "idNumber" | "licenceNumber" | "issueDate" | "expiryDate" | "licenceCode";

type Candidate<T extends string = string> = {
  value: T;
  confidence: number;
  source: string;
};

type DateRangeCandidate = {
  value: {
    issueDate: string;
    expiryDate: string;
  };
  confidence: number;
  source: string;
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
          return { value, confidence: 95, source: pattern.source };
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
    };
  }

  return {
    value: {
      issueDate: compactWhitespace(match[1]),
      expiryDate: compactWhitespace(match[2] ?? ""),
    },
    confidence: match[2] ? 92 : 86,
    source: rangePattern.source,
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
        };
      }
    }
  }
  return null;
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function extractIdNumber(lines: string[], text: string): Candidate<string> | null {
  const labelled = firstMatchingLine(lines, [
    /^\s*(?:id|identity)\s*(?:no\.?|number)?\s*[:.\-]?\s*([0-9][0-9\s-]{5,20})$/i,
  ]);
  if (labelled) {
    const digits = normalizeDigits(labelled.value);
    if (digits.length >= 8 && digits.length <= 15) {
      return { value: digits, confidence: 95, source: labelled.source };
    }
  }

  const compact = compactWhitespace(text).replace(/\s+/g, " ");
  const pattern = /\b(?:id|identity)\s*(?:no\.?|number)?\s*[:.\-]?\s*([0-9][0-9\s-]{5,20})\b/i;
  const match = compact.match(pattern);
  if (match?.[1]) {
    const digits = normalizeDigits(match[1]);
    if (digits.length >= 8 && digits.length <= 15) {
      return { value: digits, confidence: 90, source: pattern.source };
    }
  }

  const fallbackDigits = compact.match(/\b\d{8,15}\b/)?.[0];
  if (fallbackDigits) {
    return { value: fallbackDigits, confidence: 72, source: "fallback_digits" };
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
    return { value: labelled.value, confidence: 94, source: labelled.source };
  }

  const linesWithLicence = lines.filter((line) => /licen[cs]e/i.test(line));
  for (const line of linesWithLicence) {
    const shortNumber = line.match(/\b(?:no\.?|class|code)\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
    if (shortNumber) {
      return { value: shortNumber.trim(), confidence: 82, source: "licence_line_short_number" };
    }
  }

  const explicitSingleDigit = compactWhitespace(text).match(/\blicen[cs]e\s+no\.?\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
  if (explicitSingleDigit) {
    return { value: explicitSingleDigit.trim(), confidence: 80, source: "licence_no_short_value" };
  }

  const standaloneCode = compactWhitespace(text).match(/\bno\.?\s*[:.\-]?\s*([A-Za-z0-9]{1,3})\b/i)?.[1];
  if (standaloneCode) {
    return { value: standaloneCode.trim(), confidence: 70, source: "standalone_code" };
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
      return { value: cleaned, confidence: 95, source: labelled.source };
    }

    if (digits.length >= 6) {
      return { value: digits, confidence: 95, source: labelled.source };
    }

    if (cleaned) {
      return { value: cleaned, confidence: 88, source: labelled.source };
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
      return { value: digitsOnly, confidence: 92, source: "contextual_digit_line" };
    }

    if (digitsOnly.length >= 8) {
      return { value: digitsOnly, confidence: 76, source: "standalone_digit_line" };
    }
  }

  const compact = compactWhitespace(text).replace(/\s+/g, " ");
  const digitCandidates = compact
    .match(/\b\d[0-9\s-]{5,20}\b/g)
    ?.map((candidate) => normalizeDigits(candidate))
    .filter((candidate) => candidate.length >= 6 && candidate.length <= 15 && candidate !== idNumber) ?? [];
  if (digitCandidates.length > 0) {
    const best = digitCandidates.sort((left, right) => right.length - left.length)[0];
    return { value: best, confidence: 70, source: "digit_candidate" };
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
    name: name ? { value: name, confidence: 78, source: "heuristic_name_line" } : null,
    surname: surname ? { value: surname, confidence: 78, source: "heuristic_name_line" } : null,
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

export function extractDriverLicenceDetails(text: string): DriverLicenceExtraction {
  try {
    const normalized = normalizeText(text);
    const lines = splitLines(normalized);
    const { name, surname } = extractNameAndSurname(lines);
    const idNumber = extractIdNumber(lines, normalized);
    const licenceCode = extractLicenceCode(lines, normalized);
    const licenceNumber = extractLicenceNumber(lines, normalized, idNumber?.value ?? null);
  const rangeDates = extractJoinedRangeDates(normalized);
    const standaloneIssueDate = extractStandaloneDate(normalized, [
      /^\s*(?:issue(?:d)?\s+date|date\s+of\s+issue|valid\s+from)\s*[:.\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})$/i,
    ])?.value;
    const standaloneExpiryDate = extractStandaloneDate(normalized, [
      /^\s*(?:expiry\s+date|date\s+of\s+expiry|valid\s+to|valid\s+until|expires?\s+on)\s*[:.\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{2}[\/.-]\d{2})$/i,
    ])?.value;

    const issueDate = standaloneIssueDate ?? (rangeDates?.value.issueDate || null);
    const expiryDate = standaloneExpiryDate ?? (rangeDates?.value.expiryDate || null);

    const fieldConfidence = buildConfidenceMap([
      ["name", name],
      ["surname", surname],
      ["idNumber", idNumber],
      ["licenceNumber", licenceNumber],
      ["issueDate", issueDate ? { value: issueDate, confidence: rangeDates ? rangeDates.confidence : 90, source: "date" } : null],
      ["expiryDate", expiryDate ? { value: expiryDate, confidence: rangeDates ? rangeDates.confidence : 90, source: "date" } : null],
      ["licenceCode", licenceCode],
    ]);

    const confidenceSignals = [
      fieldConfidence.name ?? 0,
      fieldConfidence.surname ?? 0,
      fieldConfidence.idNumber ?? 0,
      fieldConfidence.licenceNumber ?? 0,
      fieldConfidence.issueDate ?? 0,
      fieldConfidence.expiryDate ?? 0,
      fieldConfidence.licenceCode ?? 0,
    ].filter((value) => value > 0);

    const overallConfidence = clamp(average(confidenceSignals) || 0);

    return {
      name: name?.value ?? null,
      surname: surname?.value ?? null,
      idNumber: idNumber?.value ?? null,
      licenceNumber: licenceNumber?.value ?? null,
      issueDate,
      expiryDate,
      licenceCode: licenceCode?.value ?? null,
      confidence: overallConfidence,
      fieldConfidence,
    };
  } catch {
    return {
      name: null,
      surname: null,
      idNumber: null,
      licenceNumber: null,
      issueDate: null,
      expiryDate: null,
      licenceCode: null,
      confidence: 0,
      fieldConfidence: {},
    };
  }
}
