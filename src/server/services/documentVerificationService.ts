import { extractTextFromPdfDetailed, type PdfExtractionSource } from "@/lib/pdf/extractTextFromPdf";
import { extractComplianceData } from "@/lib/intelligence/extractCompliance";

export type VerificationStatus = "PASS" | "REVIEW" | "FAIL";

export type VerificationResult = {
  verified: boolean;
  score: number;
  status: VerificationStatus;
  reason?: string;
  confidenceNotes?: string[];
  missingFields: string[];
  extractedFields: Record<string, any>;
  compliance: {
    hasCIPC: boolean;
    hasTaxClearance: boolean;
    hasBBBEE: boolean;
    hasCOIDA: boolean;
  };
  extractionSource?: PdfExtractionSource;
  extractedTextLength?: number;
  directTextLength?: number;
  ocrTextLength?: number;
  pageCount?: number;
  taxClassification?: TaxDocumentClassification;
  suggestions: string[];
};

export type VerificationContext = {
  companyName?: string | null;
  registrationNumber?: string | null;
  contactPerson?: string | null;
  relatedParties?: string[] | null;
};

type WeightedSignal = {
  key: string;
  matched: boolean;
  weight: number;
  note: string;
};

type CipcAssessment = {
  score: number;
  status: VerificationStatus;
  registrationNumber: string | null;
  missingFields: string[];
  reason?: string;
  suggestions: string[];
  confidenceNotes: string[];
  signals: WeightedSignal[];
};

type HeuristicAssessment = {
  score: number;
  status: VerificationStatus;
  reason?: string;
  suggestions: string[];
  confidenceNotes: string[];
  missingFields: string[];
  signals: WeightedSignal[];
  extractedFields: Record<string, string | null>;
  verified: boolean;
  taxClassification?: TaxDocumentClassification;
};

type TaxDateEvidence = {
  issueDate: string | null;
  issueTimestamp: number | null;
  expiryRaw: string | null;
  expiryTimestamp: number | null;
  hasConflict: boolean;
  conflictReason: string | null;
  detectedDates: string[];
};

type TaxpayerReferenceMatch = {
  rawMatchedLabel: string | null;
  rawMatchedValue: string | null;
  normalizedTaxpayerReference: string | null;
  rejectedCandidateReasons: string[];
};

export type TaxDocumentCategory =
  | "TAX_COMPLIANCE_STATUS"
  | "TCS_PIN_DOCUMENT"
  | "SARS_NOTICE_OF_REGISTRATION"
  | "VAT_REGISTRATION_NOTICE"
  | "LEGACY_TAX_CLEARANCE_CERTIFICATE"
  | "UNKNOWN_TAX_DOCUMENT";

export type TaxDocumentPurpose =
  | "ACTIVE_TAX_COMPLIANCE_PROOF"
  | "SARS_REGISTRATION_PROOF"
  | "IDENTITY_TAX_LINKAGE_SUPPORT"
  | "UNKNOWN_TAX_PURPOSE";

export type TaxDocumentClassification = {
  category: TaxDocumentCategory;
  purpose: TaxDocumentPurpose;
  confidence: number;
  complianceCapable: boolean;
  supportingOnly: boolean;
  readinessImpactReason: string;
  explainableMessage: string;
};

const REVIEW_SUGGESTIONS = [
  "Please verify registration number manually",
  "Document may be valid but could not be confidently parsed",
  "Please upload a clearer or text-based version for automatic verification",
];

const DEFAULT_OPEN_TEXT_REVIEW_REASON = "No usable text extracted from document";
const COMPANY_SUFFIX_PATTERN = /\b(?:pty|proprietary|limited|ltd|inc|llc|corp|corporation)\b/gi;

export async function verifyStoredContractorDocument(
  buffer: Buffer,
  documentType: string,
  context?: VerificationContext,
): Promise<VerificationResult> {
  const missingFields: string[] = [];
  const extractedFields: Record<string, any> = {};
  const suggestions: string[] = [];
  const confidenceNotes: string[] = [];

  let text = "";
  let extractionSource: "PDF_TEXT" | "OCR" | "EMPTY" = "EMPTY";
  let directTextLength = 0;
  let ocrTextLength = 0;
  let pageCount = 0;
  try {
    const extraction = await extractTextFromPdfDetailed(buffer, {
      filename: `${documentType || "document"}.pdf`,
    });
    text = extraction.text;
    extractionSource = extraction.source;
    directTextLength = extraction.directTextLength;
    ocrTextLength = extraction.ocrTextLength;
    pageCount = extraction.pageCount;
  } catch (error) {
    console.error("Verification text extraction failed:", error);

    const compliance = extractComplianceData("");
    const result: VerificationResult = {
      verified: false,
      score: 20,
      status: "REVIEW",
      reason: "Document text extraction failed",
      confidenceNotes: ["Parsing failed before verification completed"],
      missingFields,
      extractedFields,
      compliance,
      extractionSource: "EMPTY",
      extractedTextLength: 0,
      directTextLength: 0,
      ocrTextLength: 0,
      pageCount: 0,
      taxClassification: undefined,
      suggestions: [...REVIEW_SUGGESTIONS],
    };

    logVerificationDecision({
      documentType,
      textLength: 0,
      signals: [],
      result,
    });

    return result;
  }

  const trimmedText = text.trim();
  console.log("[AI_VALIDATION_INPUT]", {
    documentType,
    extractionSource,
    directTextLength: trimmedText.length,
    textLength: trimmedText.length,
    preview: trimmedText.slice(0, 300),
  });

  const compliance = extractComplianceData(trimmedText);

  if (trimmedText.length === 0) {
    const result: VerificationResult = {
      verified: false,
      score: 20,
      status: "REVIEW",
      reason: DEFAULT_OPEN_TEXT_REVIEW_REASON,
      confidenceNotes: ["No text content was available for weighted verification"],
      missingFields,
      extractedFields,
      compliance,
      extractionSource,
      extractedTextLength: 0,
      directTextLength,
      ocrTextLength,
      pageCount,
      taxClassification: undefined,
      suggestions: [...REVIEW_SUGGESTIONS],
    };

    logVerificationDecision({
      documentType,
      textLength: trimmedText.length,
      signals: [],
      result,
    });

    return result;
  }

  try {
    let result: VerificationResult;
    let signals: WeightedSignal[] = [];

    switch (documentType) {
      case "cipc": {
        const assessment = assessCipcEvidence(trimmedText);
        signals = assessment.signals;

        if (assessment.registrationNumber) {
          extractedFields.registrationNumber = assessment.registrationNumber;
        }

        result = {
          verified: assessment.status === "PASS",
          score: assessment.score,
          status: assessment.status,
          reason: assessment.reason,
          confidenceNotes: assessment.confidenceNotes,
          missingFields: assessment.missingFields,
          extractedFields,
          compliance,
          taxClassification: undefined,
          suggestions: assessment.suggestions,
        };
        break;
      }

      case "bbbee":
      case "taxClearance":
      case "coida":
      case "bankConfirmation":
      default:
        result = buildDocumentSpecificVerificationResult(
          trimmedText,
          documentType,
          compliance,
          extractedFields,
          context,
          extractionSource,
        );
        break;
    }

    logVerificationDecision({
      documentType,
      textLength: trimmedText.length,
      signals,
      result,
    });

    addCommonExtractedFields(result.extractedFields, trimmedText);
    result.extractionSource = extractionSource;
    result.extractedTextLength = trimmedText.length;
    result.directTextLength = directTextLength;
    result.ocrTextLength = ocrTextLength;
    result.pageCount = pageCount;

    return result;
  } catch (error) {
    console.error("Verification scoring failed:", error);

    const result: VerificationResult = {
      verified: false,
      score: 20,
      status: "REVIEW",
      reason: "Automatic verification could not be completed",
      confidenceNotes: ["Weighted scoring failed and was downgraded to manual review"],
      missingFields,
      extractedFields,
      compliance,
      extractionSource,
      extractedTextLength: trimmedText.length,
      directTextLength,
      ocrTextLength,
      pageCount,
      taxClassification: undefined,
      suggestions: [...REVIEW_SUGGESTIONS],
    };

    logVerificationDecision({
      documentType,
      textLength: trimmedText.length,
      signals: [],
      result,
    });

    return result;
  }
}

export const verifyDocument = verifyStoredContractorDocument;

function buildDocumentSpecificVerificationResult(
  text: string,
  documentType: string,
  compliance: VerificationResult["compliance"],
  extractedFields: Record<string, any>,
  context?: VerificationContext,
  extractionSource: PdfExtractionSource = "EMPTY",
): VerificationResult {
  let assessment: HeuristicAssessment;

  switch (documentType) {
    case "bbbee":
      assessment = assessBbbeeEvidence(text, context);
      break;
    case "taxClearance":
      assessment = assessTaxClearanceEvidence(text, context, extractionSource);
      break;
    case "coida":
      assessment = assessCoidaEvidence(text, context);
      break;
    case "bankConfirmation":
      assessment = assessBankConfirmationEvidence(text, context);
      break;
    default:
      assessment = {
        verified: false,
        score: 0,
        status: "FAIL",
        reason: "Document type is not recognized by the verification service",
        confidenceNotes: ["Document type is not recognized by the verification service"],
        missingFields: ["unknownDocumentType"],
        extractedFields: {},
        suggestions: [],
        signals: [],
      };
  }

  Object.assign(extractedFields, assessment.extractedFields);

  if (!compliance.hasCIPC && documentType !== "cipc" && documentType !== "bankConfirmation") {
    assessment.suggestions.push("Provide valid CIPC registration document");
  }
  if (documentType !== "taxClearance" && documentType !== "bankConfirmation" && !compliance.hasTaxClearance) {
    assessment.suggestions.push("Upload valid Tax Clearance Certificate");
  }
  if (documentType !== "bbbee" && documentType !== "bankConfirmation" && !compliance.hasBBBEE) {
    assessment.suggestions.push("Provide B-BBEE certificate");
  }
  if (documentType !== "coida" && documentType !== "bankConfirmation" && !compliance.hasCOIDA) {
    assessment.suggestions.push("Upload valid COIDA certificate");
  }

  return {
    verified: assessment.verified,
    score: assessment.score,
    status: assessment.status,
    confidenceNotes: assessment.confidenceNotes,
    missingFields: assessment.missingFields,
    extractedFields,
    compliance,
    taxClassification: assessment.taxClassification,
    suggestions: uniqueStrings(assessment.suggestions),
    reason: assessment.reason,
  };
}

function normalizeRegistrationNumber(value: string | null): string | null {
  return value ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : null;
}

function normalizeCompanyName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .toUpperCase()
    .replace(COMPANY_SUFFIX_PATTERN, " ")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function normalizePersonName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function logCompanyNormalization(
  documentType: string,
  rawValue: string | null,
  normalizedValue: string | null,
  expectedValue?: string | null,
) {
  console.log("[COMPANY_NAME_NORMALIZATION]", {
    documentType,
    rawValue,
    normalizedValue,
    expectedValue: expectedValue ?? null,
  });
}

function logRegistrationMatch(documentType: string, rawValue: string | null, expectedValue?: string | null) {
  console.log("[REGISTRATION_MATCH]", {
    documentType,
    rawValue,
    normalizedValue: normalizeRegistrationNumber(rawValue),
    expectedValue: expectedValue ? normalizeRegistrationNumber(expectedValue) : null,
  });
}

function parseFlexibleDate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const date = Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isFinite(date) ? date : null;
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const date = Date.UTC(Number(dayFirstMatch[3]), Number(dayFirstMatch[2]) - 1, Number(dayFirstMatch[1]));
    return Number.isFinite(date) ? date : null;
  }

  const monthNameMatch = trimmed.match(/^(\d{1,2})[-\s/]([A-Za-z]+)[-\s/](\d{4})$/);
  if (monthNameMatch) {
    const monthIndex = monthNames.indexOf(monthNameMatch[2].toLowerCase());
    if (monthIndex >= 0) {
      const date = Date.UTC(Number(monthNameMatch[3]), monthIndex, Number(monthNameMatch[1]));
      return Number.isFinite(date) ? date : null;
    }
  }

  return null;
}

function extractDateCandidates(text: string): string[] {
  const matches = text.match(
    /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}[-\s](?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[-\s]\d{4})\b/gi
  );
  return matches ? Array.from(new Set(matches.map((value) => value.trim()))) : [];
}

function selectExpiryDate(documentType: string, candidates: string[]): { raw: string | null; timestamp: number | null } {
  const parsed = candidates
    .map((value) => ({ raw: value, timestamp: parseFlexibleDate(value) }))
    .filter((entry): entry is { raw: string; timestamp: number } => typeof entry.timestamp === "number");

  const selected = parsed.sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;

  console.log("[EXPIRY_EXTRACTION]", {
    documentType,
    candidates,
    selectedRaw: selected?.raw ?? null,
    selectedTimestamp: selected?.timestamp ?? null,
    isExpired: selected ? selected.timestamp <= Date.now() : null,
  });

  return {
    raw: selected?.raw ?? null,
    timestamp: selected?.timestamp ?? null,
  };
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractAnyMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return match[0].trim();
    }
  }

  return null;
}

function normalizeLabel(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function extractValueAfterLabel(text: string, labels: string[]): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedLabels = labels.map(normalizeLabel);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeLabel(line);
    const labelIndex = normalizedLabels.findIndex((label) => normalizedLine === label);

    if (labelIndex >= 0) {
      for (let valueIndex = index + 1; valueIndex < lines.length; valueIndex += 1) {
        const candidate = lines[valueIndex];
        const normalizedCandidate = normalizeLabel(candidate);

        if (normalizedLabels.includes(normalizedCandidate)) {
          break;
        }

        if (candidate.length > 0) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function extractSequentialTableFields(text: string, labels: string[]): Record<string, string | null> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedLabels = labels.map(normalizeLabel);

  for (let index = 0; index <= lines.length - normalizedLabels.length; index += 1) {
    const matches = normalizedLabels.every(
      (label, offset) => normalizeLabel(lines[index + offset]) === label
    );

    if (!matches) {
      continue;
    }

    const valuesStart = index + normalizedLabels.length;
    const result: Record<string, string | null> = {};

    for (let offset = 0; offset < labels.length; offset += 1) {
      result[labels[offset]] = lines[valuesStart + offset] ?? null;
    }

    return result;
  }

  return Object.fromEntries(labels.map((label) => [label, null]));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function extractCIPCNumber(text: string): string | null {
  const match = text.match(/\b(?:\d{4}\s*\/\s*\d{5,7}\s*\/\s*\d{2}|K\d{10})\b/i);
  return match ? match[0] : null;
}

function extractCsdNumber(text: string): string | null {
  const contextual = extractFirstMatch(text, [
    /\b(?:csd|central supplier database|supplier number|supplier no|m number|m-number)\b[\s\S]{0,80}\b(M[A-Z0-9]{7,15})\b/i,
  ]);

  if (contextual) {
    return contextual.toUpperCase();
  }

  const fallback = text.match(/\bM[A-Z0-9]{7,15}\b/i);
  return fallback ? fallback[0].toUpperCase() : null;
}

function addCommonExtractedFields(fields: Record<string, any>, text: string) {
  const registrationNumber = fields.registrationNumber ?? fields.companyRegistrationNumber ?? extractCIPCNumber(text);
  const csdNumber = fields.csdNumber ?? fields.csdMNumber ?? fields.mNumber ?? extractCsdNumber(text);

  if (registrationNumber && !fields.registrationNumber) {
    fields.registrationNumber = registrationNumber;
  }

  if (registrationNumber && !fields.companyRegistrationNumber) {
    fields.companyRegistrationNumber = registrationNumber;
  }

  if (csdNumber) {
    fields.csdNumber = csdNumber;
    fields.csdMNumber = csdNumber;
    fields.mNumber = csdNumber;
  }
}

function assessCipcEvidence(text: string): CipcAssessment {
  const registrationNumber = extractCIPCNumber(text);
  const signals: WeightedSignal[] = [
    {
      key: "exact_registration_number_match",
      matched: Boolean(registrationNumber),
      weight: 55,
      note: "Exact CIPC registration number pattern detected",
    },
    {
      key: "partial_registration_pattern",
      matched:
        /\b(?:\d{4}\s*\/\s*\d{3,7}|(?:reg(?:istration)?\s*(?:no|number)?[:\s#-]*)\d{4,})\b/i.test(text),
      weight: 20,
      note: "Partial registration numbering pattern detected",
    },
    {
      key: "cipc_keywords",
      matched:
        /\b(?:cipc|companies and intellectual property commission|registration certificate|registration number|company registration)\b/i.test(
          text
        ),
      weight: 15,
      note: "CIPC or company registration wording detected",
    },
    {
      key: "document_title_relevance",
      matched:
        /\b(?:certificate of incorporation|company registration certificate|cor\d+\.\d|disclosure certificate)\b/i.test(
          text
        ),
      weight: 15,
      note: "Known CIPC document title or form reference detected",
    },
    {
      key: "contradictory_other_document_type",
      matched:
        /\b(?:tax clearance|tax compliance status|b-bbee|bbbee|coida|compensation fund|bank confirmation)\b/i.test(
          text
        ) &&
        !/\b(?:cipc|companies and intellectual property commission|registration certificate|company registration)\b/i.test(
          text
        ),
      weight: -45,
      note: "Text strongly suggests a different document type",
    },
  ];

  const score = clampScore(signals.reduce((total, signal) => total + (signal.matched ? signal.weight : 0), 0));
  const matchedSignals = signals.filter((signal) => signal.matched);
  const confidenceNotes = matchedSignals.map((signal) => signal.note);
  const contradictorySignal = signals.find((signal) => signal.key === "contradictory_other_document_type");
  const positiveSignals = matchedSignals.filter((signal) => signal.weight > 0);

  if (contradictorySignal?.matched && positiveSignals.length === 0) {
    return {
      score,
      status: "FAIL",
      registrationNumber,
      missingFields: ["registrationNumber"],
      reason: "Document appears unrelated to CIPC registration",
      suggestions: ["Provide valid CIPC registration document"],
      confidenceNotes,
      signals,
    };
  }

  if (score >= 70) {
    return {
      score,
      status: "PASS",
      registrationNumber,
      missingFields: [],
      suggestions: [],
      confidenceNotes,
      signals,
    };
  }

  if (positiveSignals.length > 0) {
    return {
      score,
      status: "REVIEW",
      registrationNumber,
      missingFields: registrationNumber ? [] : ["registrationNumber"],
      reason: registrationNumber
        ? "Document type is relevant but verification confidence is not high enough"
        : "Registration number could not be extracted confidently",
      suggestions: [...REVIEW_SUGGESTIONS],
      confidenceNotes,
      signals,
    };
  }

  return {
    score,
    status: "FAIL",
    registrationNumber,
    missingFields: ["registrationNumber"],
    reason: "Document does not contain sufficient CIPC registration evidence",
    suggestions: ["Provide valid CIPC registration document"],
    confidenceNotes,
    signals,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function extractBBBEELevel(text: string): string | null {
  const match = text.match(/(?:b[- ]?bbbee(?:\s+status)?\s+level|level)\s*[:\s]+(\d)/i)
    ?? text.match(/b[- ]?bbbee\s+level\s+(\d)\s+contributor/i);
  return match?.[1] ?? null;
}

function extractTaxPin(text: string): string | null {
  const taxPin = extractFirstMatch(text, [
    /tax compliance status pin[:\s]+([A-Z0-9-]{6,})/i,
    /\btcs pin[:\s]+([A-Z0-9-]{6,})/i,
    /\bpin[:\s]+([A-Z0-9-]{6,})/i,
  ]);

  console.log("[TAX_PIN_DETECTION]", {
    rawValue: taxPin,
    normalizedValue: taxPin ? taxPin.toUpperCase() : null,
    detected: Boolean(taxPin),
  });

  return taxPin;
}

function normalizeTaxpayerReference(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/[_/.-]/g, " ")
    .replace(/\s+/g, "")
    .trim();

  return normalized || null;
}

function isLikelyTaxpayerReference(value: string | null): { accepted: boolean; reason?: string } {
  if (!value) {
    return { accepted: false, reason: "empty_candidate" };
  }

  if (value.length < 6) {
    return { accepted: false, reason: "candidate_too_short" };
  }

  if (value.length > 20) {
    return { accepted: false, reason: "candidate_too_long" };
  }

  if (!/[0-9]/.test(value)) {
    return { accepted: false, reason: "candidate_missing_digits" };
  }

  return { accepted: true };
}

function hasNearbyTaxReferenceContext(lines: string[], index: number): boolean {
  const nearby = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join(" ");
  return /\b(?:tax|taxpayer|sars|income tax)\b/i.test(nearby);
}

function extractTaxpayerReference(text: string): TaxpayerReferenceMatch {
  const rejectedCandidateReasons: string[] = [];
  const inlinePatterns: Array<{ label: string; pattern: RegExp; requireTaxContext?: boolean }> = [
    {
      label: "Taxpayer Reference No",
      pattern: /\b(taxpayer\s+reference\s+(?:no|number))\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
    },
    {
      label: "Taxpayer Reference Number",
      pattern: /\b(taxpayer\s+reference\s+number)\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
    },
    {
      label: "Tax reference No",
      pattern: /\b(tax\s+reference\s+(?:no|number))\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
    },
    {
      label: "Income Tax Reference Number",
      pattern: /\b(income\s+tax\s+reference\s+(?:no|number))\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
    },
    {
      label: "SARS Reference",
      pattern: /\b(sars\s+reference\s+(?:no|number)?)\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
    },
    {
      label: "Reference No",
      pattern: /\b(reference\s+(?:no|number))\b[ \t:#.-]*([A-Z0-9][A-Z0-9 /.-]{5,})$/i,
      requireTaxContext: true,
    },
  ];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];

    for (const candidate of inlinePatterns) {
      const match = rawLine.match(candidate.pattern);
      if (!match?.[2]) {
        continue;
      }

      if (candidate.requireTaxContext && !hasNearbyTaxReferenceContext(lines, index)) {
        rejectedCandidateReasons.push(`${candidate.label}:missing_tax_context`);
        continue;
      }

      const normalized = normalizeTaxpayerReference(match[2]);
      const validation = isLikelyTaxpayerReference(normalized);
      if (!validation.accepted) {
        rejectedCandidateReasons.push(`${candidate.label}:${validation.reason}`);
        continue;
      }

      return {
        rawMatchedLabel: match[1]?.trim() ?? candidate.label,
        rawMatchedValue: match[2].trim(),
        normalizedTaxpayerReference: normalized,
        rejectedCandidateReasons,
      };
    }
  }

  const lineLabels: Array<{ label: string; requireTaxContext?: boolean }> = [
    { label: "Tax reference No" },
    { label: "Tax reference number" },
    { label: "Taxpayer Reference Number" },
    { label: "Taxpayer Reference No" },
    { label: "Income Tax Reference Number" },
    { label: "SARS reference number" },
    { label: "SARS reference No" },
    { label: "Reference No", requireTaxContext: true },
  ];
  const normalizedLabels = lineLabels.map((entry) => ({
    ...entry,
    normalizedLabel: normalizeLabel(entry.label),
  }));

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const normalizedLine = normalizeLabel(rawLine);
    const labelMatch = normalizedLabels.find((entry) => normalizedLine === entry.normalizedLabel);

    if (!labelMatch) {
      continue;
    }

    if (labelMatch.requireTaxContext && !hasNearbyTaxReferenceContext(lines, index)) {
      rejectedCandidateReasons.push(`${labelMatch.label}:missing_tax_context`);
      continue;
    }

    for (let valueIndex = index + 1; valueIndex < lines.length; valueIndex += 1) {
      const candidateLine = lines[valueIndex];
      const candidateNormalizedLine = normalizeLabel(candidateLine);

      if (normalizedLabels.some((entry) => entry.normalizedLabel === candidateNormalizedLine)) {
        break;
      }

      const normalized = normalizeTaxpayerReference(candidateLine);
      const validation = isLikelyTaxpayerReference(normalized);
      if (!validation.accepted) {
        rejectedCandidateReasons.push(`${labelMatch.label}:${validation.reason}`);
        continue;
      }

      return {
        rawMatchedLabel: rawLine,
        rawMatchedValue: candidateLine,
        normalizedTaxpayerReference: normalized,
        rejectedCandidateReasons,
      };
    }
  }

  return {
    rawMatchedLabel: null,
    rawMatchedValue: null,
    normalizedTaxpayerReference: null,
    rejectedCandidateReasons,
  };
}

function logTaxpayerReferenceDetection(documentType: string, match: TaxpayerReferenceMatch) {
  console.log("[TAXPAYER_REFERENCE_DETECTION]", {
    documentType,
    rawMatchedLabel: match.rawMatchedLabel,
    rawMatchedValue: match.rawMatchedValue,
    normalizedTaxpayerReference: match.normalizedTaxpayerReference,
    rejectedCandidateReasons: match.rejectedCandidateReasons,
  });
}

function hasExpectedCompanyMatch(extractedCompanyName: string | null, context?: VerificationContext): boolean {
  const expectedCompanyName = normalizeCompanyName(context?.companyName ?? null);
  if (!expectedCompanyName) {
    return Boolean(extractedCompanyName);
  }

  return extractedCompanyName === expectedCompanyName;
}

function hasExpectedRegistrationMatch(extractedRegistration: string | null, context?: VerificationContext): boolean {
  const expectedRegistration = normalizeRegistrationNumber(context?.registrationNumber ?? null);
  const normalizedExtractedRegistration = normalizeRegistrationNumber(extractedRegistration);
  if (!expectedRegistration) {
    return Boolean(normalizedExtractedRegistration);
  }

  return normalizedExtractedRegistration === expectedRegistration;
}

function extractDateByLabels(text: string, labels: string[]): string | null {
  const patterns = labels.map(
    (label) =>
      new RegExp(
        `${label}[\\s:]+(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|\\d{1,2}[-\\s](?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[-\\s]\\d{4})`,
        "i",
      ),
  );

  return extractFirstMatch(text, patterns);
}

function isSameUtcDay(left: number, right: number): boolean {
  return Math.abs(left - right) < 24 * 60 * 60 * 1000;
}

function buildTaxDateEvidence(text: string, extractionSource: PdfExtractionSource): TaxDateEvidence {
  const issueDate = extractDateByLabels(text, ["date of issue", "issue date", "issued on"]);
  const issueTimestamp = issueDate ? parseFlexibleDate(issueDate) : null;
  const labeledExpiryDate = extractDateByLabels(text, ["valid until", "expiry date", "valid to"]);
  const labeledExpiryTimestamp = labeledExpiryDate ? parseFlexibleDate(labeledExpiryDate) : null;
  const detectedDates = uniqueStrings([
    ...(labeledExpiryDate ? [labeledExpiryDate] : []),
    ...(issueDate ? [issueDate] : []),
    ...extractDateCandidates(text),
  ]);
  const parsedDetectedDates = detectedDates
    .map((raw) => ({ raw, timestamp: parseFlexibleDate(raw) }))
    .filter((entry): entry is { raw: string; timestamp: number } => typeof entry.timestamp === "number");
  const fallbackExpiry = selectExpiryDate("taxClearance", detectedDates);
  const expiryRaw = labeledExpiryTimestamp ? labeledExpiryDate : fallbackExpiry.raw;
  const expiryTimestamp = labeledExpiryTimestamp ?? fallbackExpiry.timestamp;
  const nonIssueDates = parsedDetectedDates.filter(
    (entry) => !(issueTimestamp && isSameUtcDay(entry.timestamp, issueTimestamp)),
  );
  const conflictingDates = nonIssueDates.filter(
    (entry) => !(expiryTimestamp && isSameUtcDay(entry.timestamp, expiryTimestamp)),
  );

  let conflictReason: string | null = null;
  if (issueTimestamp && expiryTimestamp && expiryTimestamp < issueTimestamp) {
    conflictReason = "Issue date occurs after the extracted expiry date";
  } else if (
    extractionSource === "OCR" &&
    !labeledExpiryTimestamp &&
    expiryTimestamp &&
    conflictingDates.length > 0
  ) {
    conflictReason = "OCR produced conflicting date candidates";
  }

  console.log("[TAX_DATE_EVIDENCE]", {
    extractionSource,
    issueDate,
    issueTimestamp,
    labeledExpiryDate,
    labeledExpiryTimestamp,
    selectedExpiryRaw: expiryRaw,
    selectedExpiryTimestamp: expiryTimestamp,
    detectedDates,
    conflictingDates: conflictingDates.map((entry) => entry.raw),
    conflictReason,
  });

  return {
    issueDate,
    issueTimestamp,
    expiryRaw,
    expiryTimestamp,
    hasConflict: Boolean(conflictReason),
    conflictReason,
    detectedDates,
  };
}

function classifyTaxDocument(text: string, taxPin: string | null): TaxDocumentClassification {
  const hasTcsStatus = /\b(?:tax compliance status|tcs)\b/i.test(text);
  const hasLegacyTaxClearance = /\btax clearance certificate\b/i.test(text);
  const hasNoticeOfRegistration = /\bnotice of registration\b/i.test(text);
  const hasVatRegistration = /\b(?:vat registration|value-added tax registration)\b/i.test(text);
  const hasVatKeyword = /\bvat\b/i.test(text);

  if (hasLegacyTaxClearance) {
    return {
      category: "LEGACY_TAX_CLEARANCE_CERTIFICATE",
      purpose: "ACTIVE_TAX_COMPLIANCE_PROOF",
      confidence: taxPin ? 90 : 82,
      complianceCapable: true,
      supportingOnly: false,
      readinessImpactReason: "Legacy tax clearance evidence is still accepted when the certificate validates.",
      explainableMessage: "Legacy Tax Clearance Certificate detected and processed for backward compatibility.",
    };
  }

  if (hasTcsStatus && taxPin) {
    return {
      category: "TCS_PIN_DOCUMENT",
      purpose: "ACTIVE_TAX_COMPLIANCE_PROOF",
      confidence: 98,
      complianceCapable: true,
      supportingOnly: false,
      readinessImpactReason: "Valid TCS PIN evidence can satisfy the tax compliance requirement.",
      explainableMessage: "TCS PIN document detected and validated successfully.",
    };
  }

  if (hasTcsStatus) {
    return {
      category: "TAX_COMPLIANCE_STATUS",
      purpose: "ACTIVE_TAX_COMPLIANCE_PROOF",
      confidence: 90,
      complianceCapable: true,
      supportingOnly: false,
      readinessImpactReason: "Tax Compliance Status evidence may unlock readiness once the required fields validate.",
      explainableMessage: "Tax Compliance Status document detected.",
    };
  }

  if (hasNoticeOfRegistration && hasVatKeyword) {
    return {
      category: "VAT_REGISTRATION_NOTICE",
      purpose: "SARS_REGISTRATION_PROOF",
      confidence: 92,
      complianceCapable: false,
      supportingOnly: true,
      readinessImpactReason: "VAT registration notice supports taxpayer validation but cannot unlock tax compliance readiness on its own.",
      explainableMessage: "Document confirms VAT registration but does not independently confirm active tax compliance.",
    };
  }

  if (hasNoticeOfRegistration) {
    return {
      category: "SARS_NOTICE_OF_REGISTRATION",
      purpose: "SARS_REGISTRATION_PROOF",
      confidence: 90,
      complianceCapable: false,
      supportingOnly: true,
      readinessImpactReason: "SARS registration documents support identity validation but do not satisfy the active tax compliance requirement.",
      explainableMessage: "SARS registration document detected, but active Tax Compliance Status proof is still required.",
    };
  }

  return {
    category: "UNKNOWN_TAX_DOCUMENT",
    purpose: hasVatRegistration ? "SARS_REGISTRATION_PROOF" : "IDENTITY_TAX_LINKAGE_SUPPORT",
    confidence: hasVatRegistration ? 62 : 40,
    complianceCapable: false,
    supportingOnly: true,
    readinessImpactReason: "The tax document could not be confirmed as active Tax Compliance Status proof.",
    explainableMessage: "Document confirms SARS registration but does not independently confirm active tax compliance.",
  };
}

function extractAllMatches(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  const matches = Array.from(text.matchAll(globalPattern))
    .map((match) => match[1]?.trim() ?? match[0]?.trim() ?? "")
    .filter((value) => value.length > 0);

  return Array.from(new Set(matches));
}

function collectContextParties(context?: VerificationContext): string[] {
  const values = [
    context?.companyName ?? null,
    context?.contactPerson ?? null,
    ...(context?.relatedParties ?? []),
  ];

  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function hasExpectedPartyMatch(extractedName: string | null, context?: VerificationContext): boolean {
  const normalizedExtracted = normalizePersonName(extractedName);
  if (!normalizedExtracted) {
    return false;
  }

  const candidates = collectContextParties(context)
    .map((value) => normalizePersonName(value))
    .filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return true;
  }

  return candidates.some((candidate) => {
    if (candidate === normalizedExtracted) {
      return true;
    }

    const extractedTokens = normalizedExtracted.split(" ");
    const candidateTokens = candidate.split(" ");
    const overlap = extractedTokens.filter((token) => candidateTokens.includes(token)).length;
    return overlap >= 2;
  });
}

function logPartyNormalization(
  documentType: string,
  rawValue: string | null,
  normalizedValue: string | null,
  expectedValues: string[],
) {
  console.log("[PARTY_NAME_NORMALIZATION]", {
    documentType,
    rawValue,
    normalizedValue,
    expectedValues,
  });
}

function logValidationFields(documentType: string, extractedFields: Record<string, string | null>, missingFields: string[]) {
  console.log("[VALIDATION_FIELDS]", {
    documentType,
    extractedFields,
    missingFields,
  });
}

function buildAssessmentResult(params: {
  documentType: string;
  signals: WeightedSignal[];
  extractedFields: Record<string, string | null>;
  missingFields: string[];
  reason?: string;
  expired?: boolean;
  passRequirementsMet: boolean;
}): HeuristicAssessment {
  const score = clampScore(params.signals.reduce((total, signal) => total + (signal.matched ? signal.weight : 0), 0));
  const matchedSignals = params.signals.filter((signal) => signal.matched);
  const confidenceNotes = matchedSignals.map((signal) => signal.note);
  const hasPositiveSignals = matchedSignals.some((signal) => signal.weight > 0);

  logValidationFields(params.documentType, params.extractedFields, params.missingFields);

  if (params.expired) {
    return {
      verified: false,
      score,
      status: "FAIL",
      reason: params.reason ?? "Document appears expired",
      suggestions: [`Upload a current ${params.documentType} document`],
      confidenceNotes: uniqueStrings([...confidenceNotes, "Document expiry date is in the past"]),
      missingFields: params.missingFields,
      extractedFields: params.extractedFields,
      signals: params.signals,
    };
  }

  if (params.passRequirementsMet && score >= 70) {
    return {
      verified: true,
      score,
      status: "PASS",
      suggestions: [],
      confidenceNotes,
      missingFields: [],
      extractedFields: params.extractedFields,
      signals: params.signals,
    };
  }

  if (hasPositiveSignals) {
    return {
      verified: false,
      score,
      status: "REVIEW",
      reason: params.reason ?? "Document is relevant but supporting fields are incomplete",
      suggestions: [...REVIEW_SUGGESTIONS],
      confidenceNotes,
      missingFields: params.missingFields,
      extractedFields: params.extractedFields,
      signals: params.signals,
    };
  }

  return {
    verified: false,
    score,
    status: "FAIL",
    reason: params.reason ?? "Document does not contain sufficient verification evidence",
    suggestions: [`Provide valid ${params.documentType} document`],
    confidenceNotes,
    missingFields: params.missingFields,
    extractedFields: params.extractedFields,
    signals: params.signals,
  };
}

function assessBbbeeEvidence(text: string, context?: VerificationContext): HeuristicAssessment {
  const enterpriseFields = extractSequentialTableFields(text, [
    "Registration number",
    "Enterprise Name",
    "Registration Date",
    "Enterprise Type",
    "Enterprise Status",
  ]);
  const certificateFields = extractSequentialTableFields(text, [
    "Certificate Number",
    "Total Number of Shareholders",
    "Number of Black Shareholders",
    "Number of White Shareholders",
    "Black Ownership Percentage",
    "White Ownership Percentage",
    "B-BBEE Status",
    "Date of Issue",
    "Expiry Date",
  ]);
  const level = extractBBBEELevel(text);
  const certificateNumber = certificateFields["Certificate Number"] ?? extractFirstMatch(text, [
    /certificate number[:\s]+([A-Z0-9/-]{4,})/i,
  ]);
  const registrationNumber = enterpriseFields["Registration number"] ?? extractCIPCNumber(text);
  const companyName = enterpriseFields["Enterprise Name"] ?? extractFirstMatch(text, [
    /enterprise name[ \t]*:[ \t]*([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /company name[ \t]*:[ \t]*([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const normalizedCompanyName = normalizeCompanyName(companyName);
  const expiry = selectExpiryDate(
    "bbbee",
    uniqueStrings([
      certificateFields["Expiry Date"] ?? "",
      ...extractDateCandidates(text),
    ])
  );
  const expired = typeof expiry.timestamp === "number" && expiry.timestamp <= Date.now();

  const expectedCompanyName = normalizeCompanyName(context?.companyName ?? null);
  const expectedRegistrationNumber = normalizeRegistrationNumber(context?.registrationNumber ?? null);
  const companyMatchesExpected = hasExpectedCompanyMatch(normalizedCompanyName, context);
  const registrationMatchesExpected = hasExpectedRegistrationMatch(registrationNumber, context);

  logRegistrationMatch("bbbee", registrationNumber, expectedRegistrationNumber);
  logCompanyNormalization("bbbee", companyName, normalizedCompanyName, expectedCompanyName);

  const signals: WeightedSignal[] = [
    { key: "bbbee_keywords", matched: /\bb[- ]?bbbee\b/i.test(text), weight: 30, note: "B-BBEE wording detected" },
    { key: "bbbee_level", matched: Boolean(level), weight: 25, note: "B-BBEE level detected" },
    { key: "certificate_number", matched: Boolean(certificateNumber), weight: 15, note: "Certificate number detected" },
    { key: "company_registration", matched: Boolean(registrationNumber), weight: 10, note: "Company registration number detected" },
    { key: "company_name", matched: Boolean(normalizedCompanyName), weight: 10, note: "Enterprise/company name detected" },
    { key: "registration_match", matched: registrationMatchesExpected, weight: 5, note: "Registration matches contractor profile" },
    { key: "company_match", matched: companyMatchesExpected, weight: 5, note: "Company name matches contractor profile" },
    { key: "expiry_date", matched: Boolean(expiry.timestamp), weight: 20, note: "Expiry date detected" },
    { key: "expired_document", matched: expired, weight: -35, note: "Certificate appears expired" },
  ];

  const extractedFields = {
    beeLevel: level,
    certificateNumber,
    registrationNumber,
    companyName: normalizedCompanyName,
    expiryDate: expiry.raw,
    expectedCompanyMatch: companyMatchesExpected ? "true" : "false",
    expectedRegistrationMatch: registrationMatchesExpected ? "true" : "false",
  };
  const missingFields = [
    ...(!level ? ["beeLevel"] : []),
    ...(!certificateNumber ? ["certificateNumber"] : []),
    ...(!expiry.raw ? ["expiryDate"] : []),
  ];

  return buildAssessmentResult({
    documentType: "bbbee",
    signals,
    extractedFields,
    missingFields,
    reason: expired
      ? "B-BBEE certificate appears expired"
      : "B-BBEE certificate fields are incomplete for automatic verification",
    expired,
    passRequirementsMet: Boolean(
      level &&
      certificateNumber &&
      expiry.timestamp &&
      !expired &&
      (!expectedCompanyName || companyMatchesExpected) &&
      (!expectedRegistrationNumber || registrationMatchesExpected)
    ),
  });
}

function assessTaxClearanceEvidence(
  text: string,
  context?: VerificationContext,
  extractionSource: PdfExtractionSource = "EMPTY",
): HeuristicAssessment {
  const taxPin = extractTaxPin(text);
  const taxpayerReferenceMatch = extractTaxpayerReference(text);
  const taxpayerReference = taxpayerReferenceMatch.normalizedTaxpayerReference;
  const taxpayerName = extractFirstMatch(text, [
    /taxpayer name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /registered name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const normalizedTaxpayerName = normalizeCompanyName(taxpayerName);
  const taxDateEvidence = buildTaxDateEvidence(text, extractionSource);
  const classification = classifyTaxDocument(text, taxPin);
  const expired =
    classification.complianceCapable &&
    !taxDateEvidence.hasConflict &&
    typeof taxDateEvidence.expiryTimestamp === "number" &&
    taxDateEvidence.expiryTimestamp <= Date.now();
  const hasTaxClearanceKeywords =
    /\b(?:tax clearance|tax compliance status|tax clearance certificate|tcs)\b/i.test(text);
  const hasSarsKeywords = /\b(?:sars|south african revenue service)\b/i.test(text);
  const hasRegistrationNotice = classification.category === "SARS_NOTICE_OF_REGISTRATION";
  const hasVatRegistrationNotice = classification.category === "VAT_REGISTRATION_NOTICE";
  const expectedCompanyName = normalizeCompanyName(context?.companyName ?? null);
  const companyMatchesExpected = hasExpectedCompanyMatch(normalizedTaxpayerName, context);

  logCompanyNormalization("taxClearance", taxpayerName, normalizedTaxpayerName, expectedCompanyName);
  logTaxpayerReferenceDetection("taxClearance", taxpayerReferenceMatch);

  const signals: WeightedSignal[] = [
    { key: "tax_clearance_keywords", matched: hasTaxClearanceKeywords, weight: 30, note: "Tax clearance or tax compliance wording detected" },
    { key: "sars_keywords", matched: hasSarsKeywords, weight: 15, note: "SARS issuer detected" },
    { key: "tax_pin", matched: Boolean(taxPin), weight: 25, note: "Tax compliance PIN detected" },
    { key: "taxpayer_reference", matched: Boolean(taxpayerReference), weight: 15, note: "Taxpayer reference detected" },
    { key: "taxpayer_name", matched: Boolean(normalizedTaxpayerName), weight: 10, note: "Taxpayer/registered name detected" },
    { key: "company_match", matched: companyMatchesExpected, weight: 10, note: "Taxpayer name matches contractor profile" },
    { key: "issue_date", matched: Boolean(taxDateEvidence.issueDate), weight: 5, note: "Issue date detected" },
    { key: "expiry_date", matched: Boolean(taxDateEvidence.expiryTimestamp), weight: 20, note: "Tax expiry date detected" },
    { key: "date_conflict", matched: taxDateEvidence.hasConflict, weight: -10, note: "Conflicting issue or expiry dates require review" },
    { key: "registration_notice_only", matched: (hasRegistrationNotice || hasVatRegistrationNotice) && !classification.complianceCapable, weight: -20, note: "Document appears to be a supporting SARS registration document rather than active tax compliance proof" },
    { key: "expired_document", matched: expired, weight: -35, note: "Tax document appears expired" },
  ];

  const extractedFields = {
    taxDocumentCategory: classification.category,
    taxDocumentPurpose: classification.purpose,
    taxClassificationConfidence: String(classification.confidence),
    taxComplianceCapable: classification.complianceCapable ? "true" : "false",
    taxSupportingOnly: classification.supportingOnly ? "true" : "false",
    readinessImpactReason: classification.readinessImpactReason,
    explainableMessage: classification.explainableMessage,
    taxPin,
    taxpayerReference,
    taxpayerReferenceMatchedLabel: taxpayerReferenceMatch.rawMatchedLabel,
    taxpayerReferenceRawValue: taxpayerReferenceMatch.rawMatchedValue,
    taxpayerReferenceRejectedReasons: taxpayerReferenceMatch.rejectedCandidateReasons.join(" | ") || null,
    taxpayerName: normalizedTaxpayerName,
    issueDate: taxDateEvidence.issueDate,
    expiryDate: taxDateEvidence.expiryRaw,
    dateConflict: taxDateEvidence.hasConflict ? "true" : "false",
    dateConflictReason: taxDateEvidence.conflictReason,
    detectedDates: taxDateEvidence.detectedDates.join(" | ") || null,
    expectedCompanyMatch: companyMatchesExpected ? "true" : "false",
  };
  const missingFields = [
    ...(classification.complianceCapable && !taxPin ? ["taxPin"] : []),
    ...(!taxpayerReference ? ["taxpayerReference"] : []),
    ...(classification.complianceCapable && !taxDateEvidence.expiryRaw ? ["expiryDate"] : []),
  ];

  if (classification.supportingOnly) {
    return {
      verified: false,
      score: clampScore(signals.reduce((total, signal) => total + (signal.matched ? signal.weight : 0), 0)),
      status: "REVIEW",
      reason: classification.explainableMessage,
      suggestions: [
        "Upload an active Tax Compliance Status (TCS) PIN document.",
        "Use this document as supporting identity or registration evidence only.",
      ],
      confidenceNotes: uniqueStrings([
        classification.readinessImpactReason,
        ...(signals.filter((signal) => signal.matched).map((signal) => signal.note)),
      ]),
      missingFields,
      extractedFields,
      signals,
      taxClassification: classification,
    };
  }

  const assessment = buildAssessmentResult({
    documentType: "taxClearance",
    signals,
    extractedFields,
    missingFields,
    reason: taxDateEvidence.hasConflict
      ? taxDateEvidence.conflictReason ?? "Tax Compliance Status dates conflict and require manual review"
      : expired
        ? "Tax Compliance Status document appears expired"
        : "Tax Compliance Status fields are incomplete for automatic verification",
    expired,
    passRequirementsMet: Boolean(
      hasTaxClearanceKeywords &&
      taxPin &&
      taxpayerReference &&
      taxDateEvidence.expiryTimestamp &&
      !taxDateEvidence.hasConflict &&
      !expired &&
      (!expectedCompanyName || companyMatchesExpected)
    ),
  });

  return {
    ...assessment,
    reason: assessment.status === "PASS" ? classification.explainableMessage : assessment.reason ?? classification.explainableMessage,
    suggestions: assessment.status === "PASS" ? [] : assessment.suggestions,
    confidenceNotes: uniqueStrings([
      classification.explainableMessage,
      ...assessment.confidenceNotes,
    ]),
    taxClassification: classification,
  };
}

function assessCoidaEvidence(text: string, context?: VerificationContext): HeuristicAssessment {
  const employerRegistrationNumber = extractFirstMatch(text, [
    /employer(?:'s)? registration(?: number)?[:\s]+([A-Z0-9/-]{4,})/i,
    /registration number[:\s]+([A-Z0-9/-]{4,})/i,
  ]);
  const policyReference = extractFirstMatch(text, [
    /policy(?: number)?[:\s]+([A-Z0-9/-]{4,})/i,
    /reference(?: number)?[:\s]+([A-Z0-9/-]{4,})/i,
    /good standing(?: number)?[:\s]+([A-Z0-9/-]{4,})/i,
  ]);
  const companyName = extractFirstMatch(text, [
    /employer name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /company name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const normalizedCompanyName = normalizeCompanyName(companyName);
  const expiry = selectExpiryDate("coida", extractDateCandidates(text));
  const expired = typeof expiry.timestamp === "number" && expiry.timestamp <= Date.now();
  const hasCoidaKeywords = /\b(?:coida|compensation fund|letter of good standing)\b/i.test(text);
  const expectedCompanyName = normalizeCompanyName(context?.companyName ?? null);
  const expectedRegistrationNumber = normalizeRegistrationNumber(context?.registrationNumber ?? null);
  const companyMatchesExpected = hasExpectedCompanyMatch(normalizedCompanyName, context);
  const registrationMatchesExpected = hasExpectedRegistrationMatch(employerRegistrationNumber, context);

  logRegistrationMatch("coida", employerRegistrationNumber, expectedRegistrationNumber);
  logCompanyNormalization("coida", companyName, normalizedCompanyName, expectedCompanyName);

  const signals: WeightedSignal[] = [
    { key: "coida_keywords", matched: hasCoidaKeywords, weight: 30, note: "COIDA or Compensation Fund wording detected" },
    { key: "employer_registration", matched: Boolean(employerRegistrationNumber), weight: 25, note: "Employer registration detected" },
    { key: "policy_reference", matched: Boolean(policyReference), weight: 10, note: "Policy/reference number detected" },
    { key: "company_name", matched: Boolean(normalizedCompanyName), weight: 10, note: "Employer/company name detected" },
    { key: "registration_match", matched: registrationMatchesExpected, weight: 10, note: "Employer registration matches contractor profile" },
    { key: "company_match", matched: companyMatchesExpected, weight: 10, note: "Employer name matches contractor profile" },
    { key: "expiry_date", matched: Boolean(expiry.timestamp), weight: 20, note: "COIDA expiry date detected" },
    { key: "expired_document", matched: expired, weight: -35, note: "COIDA document appears expired" },
  ];

  const extractedFields = {
    employerRegistrationNumber,
    policyReference,
    companyName: normalizedCompanyName,
    expiryDate: expiry.raw,
    expectedCompanyMatch: companyMatchesExpected ? "true" : "false",
    expectedRegistrationMatch: registrationMatchesExpected ? "true" : "false",
  };
  const missingFields = [
    ...(!employerRegistrationNumber ? ["employerRegistrationNumber"] : []),
    ...(!policyReference ? ["policyReference"] : []),
    ...(!expiry.raw ? ["expiryDate"] : []),
  ];

  return buildAssessmentResult({
    documentType: "coida",
    signals,
    extractedFields,
    missingFields,
    reason: expired
      ? "COIDA document appears expired"
      : "COIDA fields are incomplete for automatic verification",
    expired,
    passRequirementsMet: Boolean(
      hasCoidaKeywords &&
      employerRegistrationNumber &&
      policyReference &&
      expiry.timestamp &&
      !expired &&
      (!expectedCompanyName || companyMatchesExpected) &&
      (!expectedRegistrationNumber || registrationMatchesExpected)
    ),
  });
}

function assessBankConfirmationEvidence(text: string, context?: VerificationContext): HeuristicAssessment {
  const recognizedBanks = [
    "ABSA",
    "CAPITEC",
    "FIRST NATIONAL BANK",
    "FNB",
    "NEDBANK",
    "STANDARD BANK",
    "INVESTEC",
    "MERCANTILE",
    "BIDVEST",
    "TYMEBANK",
  ];

  const issueDate = extractFirstMatch(text, [
    /^\s*(\d{2}\/\d{2}\/\d{4})/m,
    /(?:issue date|date issued|generated on|statement date)[:\s]+(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  ]);
  const issueTimestamp = issueDate ? parseFlexibleDate(issueDate) : null;
  const isStale = typeof issueTimestamp === "number" && issueTimestamp < Date.now() - 365 * 24 * 60 * 60 * 1000;
  const bankName = extractFirstMatch(text, [
    /bank name[:\s]+([A-Z][A-ZA-Z ]{2,})/i,
    /^(Capitec Bank|Standard Bank|First National Bank|FNB|Nedbank|Absa|Investec|Mercantile|Bidvest|TymeBank)\b/im,
  ]);
  const accountHolder = extractFirstMatch(text, [
    /account name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /account holder[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const clientName = extractFirstMatch(text, [
    /(?:client details[\s\S]*?)name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const businessName = extractFirstMatch(text, [
    /(?:client details[\s\S]*?)name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
    /business name[:\s]+([A-Z0-9][A-Z0-9 '&.,()/-]{2,})/i,
  ]);
  const registrationNumber = extractFirstMatch(text, [
    /registration\/id number[:\s]+([A-Z0-9/.-]{6,})/i,
    /registration number[:\s]+([A-Z0-9/.-]{6,})/i,
  ]);
  const accountStatus = extractFirstMatch(text, [/account status[:\s]+([A-Z][A-Z ]{2,})/i]);
  const accountType = extractFirstMatch(text, [/account type[:\s]+([A-Z][A-Z0-9 ]{2,})/i]);
  const branchCode = extractFirstMatch(text, [
    /branch code[:\s]+(\d{4,10})/i,
    /branch[:\s]+(\d{4,10})/i,
  ]);
  const accountNumber = extractFirstMatch(text, [/account number[:\s]+(\d{6,20})/i]);
  const documentReferences = uniqueStrings([
    ...extractAllMatches(text, /unique document no\.?[:\s]+([A-Z0-9\-\/. ]{6,})/i),
    ...extractAllMatches(text, /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi),
  ]);

  const normalizedBusinessName = normalizeCompanyName(businessName ?? clientName ?? accountHolder ?? null);
  const normalizedAccountHolder = normalizePersonName(accountHolder ?? clientName ?? null);
  const expectedCompanyName = normalizeCompanyName(context?.companyName ?? null);
  const expectedRegistrationNumber = normalizeRegistrationNumber(context?.registrationNumber ?? null);
  const relatedParties = collectContextParties(context);
  const companyMatchesExpected = hasExpectedCompanyMatch(normalizedBusinessName, context);
  const registrationMatchesExpected = hasExpectedRegistrationMatch(registrationNumber, context);
  const accountHolderMatchesExpected =
    hasExpectedPartyMatch(accountHolder, context) || hasExpectedPartyMatch(clientName, context);
  const normalizedBankName = normalizePersonName(bankName);
  const hasRecognizedBank = Boolean(
    normalizedBankName &&
      recognizedBanks.some((bank) => normalizedBankName.includes(bank) || bank.includes(normalizedBankName)),
  );
  const hasProofOfAccountStructure =
    /\baccount confirmation letter\b/i.test(text) &&
    /\bclient details\b/i.test(text) &&
    /\baccount details\b/i.test(text);
  const accountIsActive = /\bactive\b/i.test(accountStatus ?? "");
  const accountIsInactive = /\b(?:inactive|closed|dormant|suspended|blocked)\b/i.test(accountStatus ?? "");
  const fraudIndicators = [
    !hasProofOfAccountStructure ? "Document structure does not match a proof-of-account layout" : null,
    /\beditable sample\b/i.test(text) ? "Document contains sample/editable wording" : null,
  ].filter((value): value is string => Boolean(value));

  logRegistrationMatch("bankConfirmation", registrationNumber, expectedRegistrationNumber);
  logCompanyNormalization(
    "bankConfirmation",
    businessName ?? clientName ?? accountHolder ?? null,
    normalizedBusinessName,
    expectedCompanyName,
  );
  logPartyNormalization("bankConfirmation", accountHolder, normalizedAccountHolder, relatedParties);

  const signals: WeightedSignal[] = [
    { key: "recognized_bank", matched: hasRecognizedBank, weight: 20, note: "Recognized bank detected" },
    { key: "proof_of_account_structure", matched: hasProofOfAccountStructure, weight: 20, note: "Proof-of-account structure detected" },
    { key: "active_account", matched: accountIsActive, weight: 20, note: "Account is marked active" },
    { key: "account_holder", matched: Boolean(accountHolder ?? clientName), weight: 10, note: "Account holder detected" },
    { key: "business_reference", matched: Boolean(normalizedBusinessName), weight: 10, note: "Business/client reference detected" },
    { key: "registration_number", matched: Boolean(registrationNumber), weight: 5, note: "Registration or ID number detected" },
    { key: "company_match", matched: companyMatchesExpected, weight: 5, note: "Business name matches contractor profile" },
    { key: "registration_match", matched: registrationMatchesExpected, weight: 5, note: "Registration number matches contractor profile" },
    { key: "account_holder_match", matched: accountHolderMatchesExpected, weight: 5, note: "Account holder aligns with contractor relationship" },
    { key: "branch_code", matched: Boolean(branchCode), weight: 5, note: "Branch code detected" },
    { key: "account_number", matched: Boolean(accountNumber), weight: 5, note: "Account number detected" },
    { key: "issue_date", matched: Boolean(issueTimestamp), weight: 5, note: "Issue date detected" },
    { key: "document_reference", matched: documentReferences.length > 0, weight: 5, note: "Document reference detected" },
    { key: "stale_document", matched: isStale, weight: -15, note: "Bank confirmation appears stale" },
    { key: "inactive_account", matched: accountIsInactive, weight: -40, note: "Account is not active" },
    {
      key: "company_mismatch",
      matched: Boolean(expectedCompanyName) && !companyMatchesExpected && !registrationMatchesExpected,
      weight: -20,
      note: "Business reference does not align with contractor profile",
    },
    {
      key: "account_holder_mismatch",
      matched: Boolean(accountHolder ?? clientName) && relatedParties.length > 0 && !accountHolderMatchesExpected && !companyMatchesExpected,
      weight: -15,
      note: "Account holder does not align with contractor relationship",
    },
    { key: "fraud_indicators", matched: fraudIndicators.length > 0, weight: -20, note: "Potential document integrity issues detected" },
  ];

  const extractedFields = {
    bankName,
    accountHolder: accountHolder ?? clientName,
    businessName: normalizedBusinessName,
    companyName: normalizedBusinessName,
    accountStatus,
    accountType,
    branchCode,
    accountNumber,
    issueDate,
    registrationNumber,
    documentReferenceIdentifiers: documentReferences.join(" | ") || null,
    expectedCompanyMatch: companyMatchesExpected ? "true" : "false",
    expectedRegistrationMatch: registrationMatchesExpected ? "true" : "false",
    expectedAccountHolderMatch: accountHolderMatchesExpected ? "true" : "false",
  };
  const missingFields = [
    ...(!bankName ? ["bankName"] : []),
    ...(!(accountHolder ?? clientName) ? ["accountHolder"] : []),
    ...(!normalizedBusinessName ? ["businessName"] : []),
    ...(!accountStatus ? ["accountStatus"] : []),
    ...(!accountType ? ["accountType"] : []),
    ...(!branchCode ? ["branchCode"] : []),
    ...(!accountNumber ? ["accountNumber"] : []),
    ...(!issueDate ? ["issueDate"] : []),
    ...(documentReferences.length === 0 ? ["documentReferenceIdentifiers"] : []),
  ];
  const signalScore = clampScore(signals.reduce((total, signal) => total + (signal.matched ? signal.weight : 0), 0));
  const matchedSignals = signals.filter((signal) => signal.matched);
  const confidenceNotes = uniqueStrings(matchedSignals.map((signal) => signal.note));

  if (accountIsInactive || !hasProofOfAccountStructure || !hasRecognizedBank) {
    logValidationFields("bankConfirmation", extractedFields, missingFields);

    return {
      verified: false,
      score: signalScore,
      status: "FAIL",
      reason: accountIsInactive
        ? "Bank verification failed because the account is not active"
        : "Bank verification failed due to unsupported or invalid proof-of-account structure",
      suggestions: [
        accountIsInactive
          ? "Provide an active bank account confirmation document"
          : "Upload a current proof-of-account document in the official bank format",
      ],
      confidenceNotes,
      missingFields,
      extractedFields,
      signals,
    };
  }

  const passRequirementsMet = Boolean(
    hasRecognizedBank &&
      hasProofOfAccountStructure &&
      accountIsActive &&
      !accountIsInactive &&
      (accountHolder ?? clientName) &&
      normalizedBusinessName &&
      accountType &&
      branchCode &&
      accountNumber &&
      issueTimestamp &&
      !isStale &&
      documentReferences.length > 0 &&
      (!expectedCompanyName || companyMatchesExpected || registrationMatchesExpected) &&
      (relatedParties.length === 0 || accountHolderMatchesExpected || companyMatchesExpected)
  );

  let reason = "Bank confirmation fields are incomplete for automatic verification";
  if (accountIsInactive) {
    reason = "Bank verification failed because the account is not active";
  } else if (!hasProofOfAccountStructure || !hasRecognizedBank) {
    reason = "Bank verification failed due to unsupported or invalid proof-of-account structure";
  } else if (Boolean(expectedCompanyName) && !companyMatchesExpected && !registrationMatchesExpected) {
    reason = "Business name partially matches contractor profile";
  } else if (relatedParties.length > 0 && !accountHolderMatchesExpected && !companyMatchesExpected) {
    reason = "Bank verification failed due to account-holder mismatch";
  } else if (isStale) {
    reason = "Bank confirmation appears stale and should be refreshed";
  } else if (fraudIndicators.length > 0) {
    reason = "Bank verification failed due to document integrity concerns";
  }

  return buildAssessmentResult({
    documentType: "bankConfirmation",
    signals,
    extractedFields,
    missingFields,
    reason,
    expired: false,
    passRequirementsMet,
  });
}

function logVerificationDecision(params: {
  documentType: string;
  textLength: number;
  signals: WeightedSignal[];
  result: VerificationResult;
}) {
  console.log("[VERIFICATION_DECISION]", {
    documentType: params.documentType,
    textLength: params.textLength,
    weightedSignals: params.signals.map((signal) => ({
      key: signal.key,
      matched: signal.matched,
      weight: signal.weight,
      note: signal.note,
    })),
    finalStatus: params.result.status,
    finalScore: params.result.score,
    verified: params.result.verified,
    reason: params.result.reason ?? null,
    taxClassification: params.result.taxClassification ?? null,
    missingFields: params.result.missingFields,
    confidenceNotes: params.result.confidenceNotes ?? [],
    suggestions: params.result.suggestions,
  });
}
