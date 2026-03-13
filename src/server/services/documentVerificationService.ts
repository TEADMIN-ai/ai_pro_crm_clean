import { PDFParse } from "pdf-parse";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
import { verifyComplianceDocument } from "@/lib/compliance/analyzeComplianceDocument";
import {
  isSupportedDocumentType,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
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
    const parser = new PDFParse({ data: pdfBuffer });
    let text = "";
    let extractionMethod: "pdf-parse" | "ocr" = "pdf-parse";

    try {
      const parsed = await parser.getText();
      text = parsed.text.trim();
    } finally {
      await parser.destroy();
    }

    console.log("----- DOCUMENT DEBUG -----");
    console.log("Document ID:", documentId);
    console.log("Extracted text length:", text?.length ?? 0);
    if (text) {
      console.log("Text preview:", text.slice(0, 500));
    } else {
      console.log("No text extracted");
    }
    console.log("--------------------------");

    if (!text || text.length < 100) {
      console.log("FALLBACK: OCR triggered");
      text = await extractTextOCR(pdfBuffer);
      extractionMethod = "ocr";
      console.log("----- DOCUMENT DEBUG -----");
      console.log("Document ID:", documentId);
      console.log("Extracted text length:", text?.length ?? 0);
      if (text) {
        console.log("Text preview:", text.slice(0, 500));
      } else {
        console.log("No text extracted");
      }
      console.log("--------------------------");
    }

    const detectedType = detectDocumentType(text, input.documentType);

    if (!detectedType) {
      await documentRef.set(
        {
          status: "invalid",
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

    const analysis = verifyComplianceDocument(detectedType, text);
    console.log("AI ANALYSIS RESULT");
    console.log(JSON.stringify(analysis, null, 2));
    const extractedData = {
      detectedDocumentType: detectedType,
      ...analysis.extractedFields,
    };

    await documentRef.set(
      {
        documentType: detectedType,
        docType: detectedType,
        status: analysis.status,
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
