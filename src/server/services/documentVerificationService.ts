import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
import { verifyComplianceDocument } from "@/lib/compliance/analyzeComplianceDocument";
import {
  isSupportedDocumentType,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";
import { updateComplianceState } from "@/lib/compliance/updateComplianceState";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { extractTextOCR } from "@/server/services/ocrService";

type VerificationInput = {
  contractorId: string;
  documentId?: string;
  documentType?: string | null;
  storagePath: string;
  fileName?: string | null;
};

type VerificationResult = Awaited<ReturnType<typeof verifyStoredContractorDocument>>;

const DETECTION_RULES: Array<{ type: SupportedDocumentType; patterns: RegExp[] }> = [
  {
    type: "cipc",
    patterns: [/cipc/i, /company(?:\s+|)registration/i, /\b\d{4}\/\d{6}\/\d{2}\b/],
  },
  {
    type: "bbbee",
    patterns: [/b[\s-]?bbbee/i, /broad-based black economic empowerment/i, /status level/i],
  },
  {
    type: "taxClearance",
    patterns: [/tax compliance/i, /tax clearance/i, /tax compliance status pin/i],
  },
  {
    type: "coida",
    patterns: [/coida/i, /compensation fund/i, /employer(?:'s)? registration/i],
  },
  {
    type: "bankConfirmation",
    patterns: [/bank confirmation/i, /account number/i, /branch code/i],
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

type ContractorVerificationProfile = {
  companyName: string | null;
  registrationNumber: string | null;
};

async function getContractorVerificationProfile(
  contractorId: string
): Promise<ContractorVerificationProfile> {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  const data = snapshot.data();

  const companyName =
    typeof data?.companyName === "string" && data.companyName.trim().length > 0
      ? data.companyName.trim()
      : null;
  const registrationNumber =
    typeof data?.companyRegistrationNumber === "string" && data.companyRegistrationNumber.trim().length > 0
      ? data.companyRegistrationNumber.trim()
      : typeof data?.registrationNumber === "string" && data.registrationNumber.trim().length > 0
        ? data.registrationNumber.trim()
        : null;

  return {
    companyName,
    registrationNumber,
  };
}

function applyCompanyNameValidationFallback(
  analysis: ReturnType<typeof verifyComplianceDocument>,
  extractedText: string,
  contractorCompanyName: string | null
): ReturnType<typeof verifyComplianceDocument> {
  if (!contractorCompanyName) {
    return analysis;
  }

  const docText = normalizeText(extractedText);
  const company = normalizeText(contractorCompanyName);
  const companyNameMatches = Boolean(docText && company && docText.includes(company));

  if (!companyNameMatches || !analysis.missingFields.includes("companyName")) {
    return analysis;
  }

  const missingFields = analysis.missingFields.filter((field) => field !== "companyName");
  const extractedFields = {
    ...analysis.extractedFields,
    companyName: analysis.extractedFields.companyName ?? contractorCompanyName,
  };
  const validationErrors = missingFields.length === 0 ? [] : analysis.validationErrors;
  const validationError = missingFields.length === 0 ? null : analysis.validationError;
  const verified = missingFields.length === 0 ? true : analysis.verified;
  const status = missingFields.length === 0 && analysis.status === "invalid" ? "verified" : analysis.status;

  return {
    ...analysis,
    extractedFields,
    missingFields,
    validationErrors,
    validationError,
    verified,
    status,
  };
}

function getNamedField(fields: Record<string, string | null>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function resolveValidationStatus(expiresAt: number | null, verified: boolean, validationError: string | null) {
  const now = Date.now();

  if (typeof expiresAt === "number") {
    if (expiresAt <= now) {
      return "expired" as const;
    }

    if (expiresAt <= now + 30 * 24 * 60 * 60 * 1000) {
      return "expiringSoon" as const;
    }
  }

  if (verified) {
    return "verified" as const;
  }

  if (validationError) {
    return "invalid" as const;
  }

  return "uploaded" as const;
}

function applyDocumentAwareValidation(
  analysis: ReturnType<typeof verifyComplianceDocument>,
  contractorProfile: ContractorVerificationProfile
): ReturnType<typeof verifyComplianceDocument> {
  const extractedFields = {
    ...analysis.extractedFields,
  };

  const registrationNumber = getNamedField(
    extractedFields,
    "registrationNumber",
    "companyRegistrationNumber"
  );
  const certificateNumber = getNamedField(extractedFields, "certificateNumber");
  const beeLevel = getNamedField(extractedFields, "beeLevel");
  const taxReferenceNumber = getNamedField(extractedFields, "taxReferenceNumber", "taxPin");
  const coidaNumber = getNamedField(
    extractedFields,
    "coidaRegistrationNumber",
    "employerRegistrationNumber",
    "registrationNumber"
  );
  const expiryDate = getNamedField(extractedFields, "expiryDate");

  if (registrationNumber && !extractedFields.registrationNumber) {
    extractedFields.registrationNumber = registrationNumber;
  }
  if (taxReferenceNumber && !extractedFields.taxReferenceNumber) {
    extractedFields.taxReferenceNumber = taxReferenceNumber;
  }
  if (coidaNumber && !extractedFields.coidaRegistrationNumber) {
    extractedFields.coidaRegistrationNumber = coidaNumber;
  }

  let verified = analysis.verified;
  let missingFields = [...analysis.missingFields];
  let validationErrors = [...analysis.validationErrors];
  let validationError = analysis.validationError;

  switch (analysis.documentType) {
    case "cipc": {
      if (registrationNumber) {
        verified = true;
        missingFields = missingFields.filter(
          (field) => field !== "registrationNumber" && field !== "companyRegistrationNumber"
        );

        const contractorRegistration = contractorProfile.registrationNumber?.replace(/\s+/g, "") ?? null;
        const documentRegistration = registrationNumber.replace(/\s+/g, "");
        if (
          contractorRegistration &&
          contractorRegistration.toLowerCase() === documentRegistration.toLowerCase()
        ) {
          extractedFields.registrationNumberMatchesContractor = "true";
        }
      }
      break;
    }

    case "bbbee":
      verified = Boolean(beeLevel && certificateNumber);
      missingFields = missingFields.filter(
        (field) => field !== "beeLevel" && field !== "certificateNumber"
      );
      break;

    case "taxClearance":
      verified = Boolean(taxReferenceNumber && expiryDate);
      missingFields = missingFields.filter(
        (field) => field !== "taxReferenceNumber" && field !== "taxPin" && field !== "expiryDate"
      );
      break;

    case "coida":
      verified = Boolean(coidaNumber && expiryDate);
      missingFields = missingFields.filter(
        (field) =>
          field !== "coidaNumber" &&
          field !== "coidaRegistrationNumber" &&
          field !== "employerRegistrationNumber" &&
          field !== "expiryDate"
      );
      break;

    default:
      break;
  }

  if (verified) {
    validationError = null;
    validationErrors = [];
  }

  const status = resolveValidationStatus(analysis.expiresAt, verified, validationError);

  return {
    ...analysis,
    extractedFields,
    verified,
    missingFields,
    validationErrors,
    validationError,
    status,
  };
}

function getBucketName(): string | undefined {
  const value = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function detectDocumentType(text: string, fallbackType?: string | null): SupportedDocumentType | null {
  if (fallbackType && isSupportedDocumentType(fallbackType)) {
    return fallbackType;
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  let bestMatch: { type: SupportedDocumentType; score: number } | null = null;

  for (const rule of DETECTION_RULES) {
    const score = rule.patterns.reduce((count, pattern) => count + Number(pattern.test(normalizedText)), 0);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { type: rule.type, score };
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch.type : null;
}

function getDocumentRef(contractorId: string, documentId: string) {
  return getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentId);
}

async function downloadPdfBuffer(storagePath: string): Promise<Buffer> {
  const bucketName = getBucketName();
  const storage = getStorage(getAdminApp());
  const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();
  const [bytes] = await bucket.file(storagePath).download();
  return Buffer.from(bytes);
}

function logDocumentDebug(documentId: string, text: string) {
  console.log("DOCUMENT DEBUG");
  console.log("Document ID:", documentId);
  console.log("TEXT LENGTH", text?.length ?? 0);
  console.log("TEXT PREVIEW", text ? text.slice(0, 500) : "No text extracted");
}

export async function verifyStoredContractorDocument(input: VerificationInput) {
  const documentId = input.documentId ?? input.documentType ?? "";
  if (!input.contractorId.trim()) {
    throw new Error("Missing contractorId");
  }
  if (!documentId.trim()) {
    throw new Error("Missing documentId");
  }
  if (!input.storagePath.trim()) {
    throw new Error("Missing storagePath");
  }

  const documentRef = getDocumentRef(input.contractorId, documentId);
  const verifiedAt = new Date();

  try {
    const pdfBuffer = await downloadPdfBuffer(input.storagePath.trim());
    const contractorProfile = await getContractorVerificationProfile(input.contractorId);
    let text = "";
    let extractionMethod: "pdf-parse" | "ocr" = "pdf-parse";

    try {
      text = (await extractTextFromPdf(pdfBuffer)).trim();
    } catch (error) {
      console.error("PDF EXTRACTION FAILED", error);
      throw new Error("pdf_extraction_failed");
    }

    logDocumentDebug(documentId, text);

    if (!text || text.length < 100) {
      console.log("FALLBACK: OCR triggered");
      text = await extractTextOCR(pdfBuffer);
      extractionMethod = "ocr";
      logDocumentDebug(documentId, text);
    }

    const detectedType = detectDocumentType(text, input.documentType);

    if (!detectedType) {
      await documentRef.set(
        {
          status: "invalid",
          validationStatus: "invalid",
          verified: false,
          verifiedAt: null,
          validationError: "Unable to detect document type",
          extractedData: {
            detectedDocumentType: null,
          },
          extractedFields: {
            detectedDocumentType: null,
          },
          missingFields: ["detectedDocumentType"],
          validationErrors: ["Unable to detect document type"],
          analysisTimestamp: verifiedAt.getTime(),
          extractionMethod,
          extractedTextLength: text.length,
          updatedAt: verifiedAt,
        },
        { merge: true }
      );

      await recalculateContractorCompliance(getFirebaseAdmin(), input.contractorId);

      return {
        status: "invalid" as const,
        extractedData: { detectedDocumentType: null },
        verifiedAt: null,
      };
    }

    const baseAnalysis = verifyComplianceDocument(detectedType, text);
    const documentAwareAnalysis = applyDocumentAwareValidation(baseAnalysis, contractorProfile);
    const analysis = applyCompanyNameValidationFallback(
      documentAwareAnalysis,
      text,
      contractorProfile.companyName
    );
    console.log("Document type detected:", detectedType);
    console.log("Fields detected:", analysis.extractedFields);
    console.log("Validation result:", analysis.status);
    console.log("AI ANALYSIS RESULT");
    console.log(JSON.stringify(analysis, null, 2));
    console.log("VALIDATION RESULT");
    console.log(
      JSON.stringify(
        {
          status: analysis.status,
          verified: analysis.verified,
          validationError: analysis.validationError,
          missingFields: analysis.missingFields,
          validationErrors: analysis.validationErrors,
        },
        null,
        2
      )
    );
    const extractedData = {
      detectedDocumentType: detectedType,
      ...analysis.extractedFields,
    };

    await documentRef.set(
      {
        documentType: detectedType,
        docType: detectedType,
        status: analysis.status,
        validationStatus: analysis.status,
        verified: analysis.verified,
        verifiedAt: analysis.verified ? FieldValue.serverTimestamp() : null,
        validationError: analysis.validationError,
        expiresAt: analysis.expiresAt,
        extractedAt: verifiedAt,
        confidenceScore: analysis.confidenceScore,
        extractedData,
        extractedFields: extractedData,
        missingFields: analysis.missingFields,
        validationErrors: analysis.validationErrors,
        analysisTimestamp: verifiedAt.getTime(),
        extractionMethod,
        extractedTextLength: text.length,
        updatedAt: verifiedAt,
      },
      { merge: true }
    );

    await updateComplianceState(getFirebaseAdmin(), input.contractorId, analysis);
    await getFirebaseAdmin()
      .collection("contractors")
      .doc(input.contractorId)
      .collection("complianceData")
      .doc(detectedType)
      .set(
        {
          extractedData,
          extractedFields: extractedData,
          validationStatus: analysis.status,
          missingFields: analysis.missingFields,
          validationErrors: analysis.validationErrors,
          analysisTimestamp: verifiedAt.getTime(),
          extractionMethod,
          extractedTextLength: text.length,
          updatedAt: verifiedAt,
        },
        { merge: true }
      );

    await recalculateContractorCompliance(getFirebaseAdmin(), input.contractorId);

    return {
      status: analysis.status,
      extractedData,
      verifiedAt: analysis.verified ? verifiedAt.getTime() : null,
    };
  } catch (error) {
    await documentRef.set(
      {
        status: "invalid",
        validationStatus: "invalid",
        verified: false,
        verifiedAt: null,
        validationError: error instanceof Error ? error.message : "Document verification failed",
        extractedData: {
          detectedDocumentType: input.documentType && isSupportedDocumentType(input.documentType) ? input.documentType : null,
        },
        extractedFields: {
          detectedDocumentType: input.documentType && isSupportedDocumentType(input.documentType) ? input.documentType : null,
        },
        missingFields: [],
        validationErrors: [error instanceof Error ? error.message : "Document verification failed"],
        analysisTimestamp: verifiedAt.getTime(),
        extractionMethod: "pdf-parse",
        extractedTextLength: 0,
        updatedAt: verifiedAt,
      },
      { merge: true }
    );

    await recalculateContractorCompliance(getFirebaseAdmin(), input.contractorId);
    throw error;
  }
}

export type ContractorDocumentVerificationResult = VerificationResult;
