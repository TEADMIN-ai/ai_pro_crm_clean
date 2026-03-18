import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";
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
  suggestions: string[];
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

const REVIEW_SUGGESTIONS = [
  "Please verify registration number manually",
  "Document may be valid but could not be confidently parsed",
  "Please upload a clearer or text-based version for automatic verification",
];

const DEFAULT_OPEN_TEXT_REVIEW_REASON = "No usable text extracted from document";

export async function verifyStoredContractorDocument(
  buffer: Buffer,
  documentType: string
): Promise<VerificationResult> {
  const missingFields: string[] = [];
  const extractedFields: Record<string, any> = {};
  const suggestions: string[] = [];
  const confidenceNotes: string[] = [];

  let text = "";
  try {
    text = await extractTextFromPdf(buffer);
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
  console.log("Verification input text length:", trimmedText.length);
  console.log("Verification input text preview:", trimmedText.slice(0, 500));

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
          suggestions: assessment.suggestions,
        };
        break;
      }

      case "bbbee":
      case "taxClearance":
      case "coida":
      default:
        result = buildLegacyVerificationResult(trimmedText, documentType, compliance, extractedFields);
        break;
    }

    logVerificationDecision({
      documentType,
      textLength: trimmedText.length,
      signals,
      result,
    });

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

function buildLegacyVerificationResult(
  text: string,
  documentType: string,
  compliance: VerificationResult["compliance"],
  extractedFields: Record<string, any>
): VerificationResult {
  const missingFields: string[] = [];
  const suggestions: string[] = [];
  const confidenceNotes: string[] = [];

  let verified = true;
  let score =
    (compliance.hasCIPC ? 25 : 0) +
    (compliance.hasBBBEE ? 25 : 0) +
    (compliance.hasTaxClearance ? 25 : 0) +
    (compliance.hasCOIDA ? 25 : 0);
  let status: VerificationStatus = "FAIL";

  switch (documentType) {
    case "bbbee":
      if (!compliance.hasBBBEE) {
        verified = false;
        missingFields.push("beeLevel");
        confidenceNotes.push("B-BBEE wording was not detected confidently");
      } else {
        extractedFields.beeLevel = extractBBBEELevel(text);
      }
      break;

    case "taxClearance":
      if (!compliance.hasTaxClearance) {
        verified = false;
        missingFields.push("taxClearance");
        confidenceNotes.push("Tax clearance wording was not detected confidently");
      }
      break;

    case "coida":
      if (!compliance.hasCOIDA) {
        verified = false;
        missingFields.push("coida");
        confidenceNotes.push("COIDA wording was not detected confidently");
      }
      break;

    default:
      verified = false;
      missingFields.push("unknownDocumentType");
      confidenceNotes.push("Document type is not recognized by the verification service");
      break;
  }

  status = score >= 75 ? "PASS" : "FAIL";

  if (!compliance.hasCIPC && documentType !== "cipc") {
    suggestions.push("Provide valid CIPC registration document");
  }
  if (!compliance.hasTaxClearance) {
    suggestions.push("Upload valid Tax Clearance Certificate");
  }
  if (!compliance.hasBBBEE) {
    suggestions.push("Provide B-BBEE certificate");
  }
  if (!compliance.hasCOIDA) {
    suggestions.push("Upload valid COIDA certificate");
  }

  return {
    verified,
    score,
    status,
    confidenceNotes,
    missingFields,
    extractedFields,
    compliance,
    suggestions,
  };
}

function extractCIPCNumber(text: string): string | null {
  const match = text.match(/\b(?:\d{4}\s*\/\s*\d{5,7}\s*\/\s*\d{2}|K\d{10})\b/i);
  return match ? match[0] : null;
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
  const match = text.match(/level\s?\d/i);
  return match ? match[0] : null;
}

function logVerificationDecision(params: {
  documentType: string;
  textLength: number;
  signals: WeightedSignal[];
  result: VerificationResult;
}) {
  console.log("Verification decision:", {
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
    missingFields: params.result.missingFields,
    confidenceNotes: params.result.confidenceNotes ?? [],
    suggestions: params.result.suggestions,
  });
}
