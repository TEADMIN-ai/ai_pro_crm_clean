const admin = require("firebase-admin");
const OpenAI = require("openai");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

const REQUIRED_DOCS = ["cipc", "tax", "bbbee", "coida"];
const DEFAULT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";
const REGION = "africa-south1";

if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function parseExpiryDateToTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const normalized = trimmed.replace(/[.]/g, "/");
  const isoMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const parsed = Date.UTC(year, month - 1, day);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const localMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localMatch) {
    const first = Number(localMatch[1]);
    const second = Number(localMatch[2]);
    const year = Number(localMatch[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const parsed = Date.UTC(year, month - 1, day);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? null : fallback;
}

function clampConfidenceScore(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function extractJsonPayload(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced && fenced[1] ? fenced[1] : content).trim();
}

function documentMatchesRequirement(documentId, requirement) {
  const normalized = String(documentId || "").trim().toLowerCase();

  if (requirement === "tax") {
    return normalized === "tax" || normalized === "taxclearance";
  }

  return normalized === requirement;
}

function hasUploadedFile(document) {
  return typeof document.fileUrl === "string" ||
    typeof document.downloadURL === "string" ||
    typeof document.url === "string";
}

function toConfidenceScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function toValidationScore(document) {
  if (document.aiData && document.aiData.valid === true) {
    return 100;
  }

  if (document.aiStatus === "failed" || document.aiStatus === "pending") {
    return 0;
  }

  if (document.aiValidated === true) {
    return 0;
  }

  return document.verified === true ? 100 : 0;
}

async function validateDocument({ storagePath, documentType }) {
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["AI validation unavailable"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  if (!storagePath) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["Missing storagePath"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  const bucket = admin.storage().bucket();
  const [buffer] = await bucket.file(storagePath).download();
  const base64 = Buffer.from(buffer).toString("base64");

  const response = await openai.responses.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: "document_validation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            valid: { type: "boolean" },
            extractedFields: {
              type: "object",
              additionalProperties: false,
              properties: {
                registrationNumber: { type: ["string", "null"] },
                expiryDate: { type: ["string", "null"] },
                companyName: { type: ["string", "null"] },
              },
              required: ["registrationNumber", "expiryDate", "companyName"],
            },
            issues: {
              type: "array",
              items: { type: "string" },
            },
            confidenceScore: { type: "number" },
            fraudIndicators: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["valid", "extractedFields", "issues", "confidenceScore", "fraudIndicators"],
        },
      },
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You validate contractor compliance documents. " +
              "Return only structured JSON. " +
              "Mark valid true only when the document appears authentic, complete, and fit for compliance use. " +
              "Flag inconsistencies, missing identifiers, expired dates, and fraud indicators.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: `${documentType || "document"}.pdf`,
            file_data: `data:application/pdf;base64,${base64}`,
          },
          {
            type: "input_text",
            text:
              `Document type: ${documentType}\n` +
              `Storage path: ${storagePath}\n\n` +
              "Extract and validate:\n" +
              "- registrationNumber\n" +
              "- expiryDate\n" +
              "- companyName\n" +
              "- validity\n" +
              "- issues\n" +
              "- fraudIndicators\n" +
              "- confidenceScore (0-100)\n",
          },
        ],
      },
    ],
  });

  if (!response.output_text) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["AI validation returned an empty response"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  const parsed = JSON.parse(extractJsonPayload(response.output_text));
  const extractedFields = parsed && typeof parsed.extractedFields === "object" ? parsed.extractedFields : {};

  return {
    valid: parsed && parsed.valid === true,
    extractedFields: {
      registrationNumber: normalizeString(extractedFields.registrationNumber),
      expiryDate: normalizeString(extractedFields.expiryDate),
      companyName: normalizeString(extractedFields.companyName),
    },
    issues: Array.isArray(parsed && parsed.issues)
      ? parsed.issues.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [],
    confidenceScore: clampConfidenceScore(parsed && parsed.confidenceScore),
    fraudIndicators: Array.isArray(parsed && parsed.fraudIndicators)
      ? parsed.fraudIndicators.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [],
  };
}

async function updateContractorIntelligence(contractorId) {
  const db = admin.firestore();
  const documentsSnapshot = await db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  const documents = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const existingDocs = documents.map((doc) => doc.id);
  const completed = REQUIRED_DOCS.filter((requirement) =>
    existingDocs.some((documentId) => documentMatchesRequirement(documentId, requirement))
  );
  const missing = REQUIRED_DOCS.filter((requirement) =>
    !existingDocs.some((documentId) => documentMatchesRequirement(documentId, requirement))
  );

  const complianceScore = Math.round((completed.length / REQUIRED_DOCS.length) * 100);
  const complianceStatus =
    complianceScore === 100 ? "complete" : complianceScore >= 60 ? "partial" : "risk";

  const uploadedDocuments = documents.filter(hasUploadedFile);
  const averageConfidenceScore =
    uploadedDocuments.length > 0
      ? uploadedDocuments.reduce((sum, document) => sum + toConfidenceScore(document.confidenceScore), 0) /
        uploadedDocuments.length
      : 0;
  const averageValidationScore =
    uploadedDocuments.length > 0
      ? uploadedDocuments.reduce((sum, document) => sum + toValidationScore(document), 0) / uploadedDocuments.length
      : 0;

  const documentQualityScore = Math.round((averageConfidenceScore + averageValidationScore) / 2);
  const readinessScore = Math.round(complianceScore * 0.6 + documentQualityScore * 0.4);
  const readinessStatus = readinessScore >= 80 ? "READY" : readinessScore >= 60 ? "RISK" : "BLOCKED";

  await db
    .collection("contractors")
    .doc(contractorId)
    .set(
      {
        complianceScore,
        complianceCompleted: completed,
        complianceMissing: missing,
        complianceStatus,
        documentQualityScore,
        readinessScore,
        readinessStatus,
        updatedAt: new Date(),
      },
      { merge: true }
    );
}

exports.onContractorDocumentCreated = onDocumentCreated(
  {
    document: "contractors/{contractorId}/documents/{docType}",
    region: REGION,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("Document trigger fired without snapshot data");
      return;
    }

    const contractorId = event.params.contractorId;
    const docType = event.params.docType;
    const documentRef = snapshot.ref;

    logger.info("document intelligence trigger start", {
      contractorId,
      docType,
      path: documentRef.path,
    });

    const currentSnapshot = await documentRef.get();
    const currentData = currentSnapshot.data() || {};

    if (currentData.aiStatus === "complete") {
      logger.info("document intelligence skipped: already processed", {
        contractorId,
        docType,
        path: documentRef.path,
      });
      return;
    }

    const storagePath = normalizeString(currentData.storagePath);
    const documentType = normalizeString(currentData.documentType) || docType;

    if (!storagePath) {
      await documentRef.set(
        {
          aiStatus: "failed",
          aiError: "Missing storagePath",
          aiValidated: false,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      logger.error("document intelligence failed: missing storagePath", {
        contractorId,
        docType,
        path: documentRef.path,
      });

      await updateContractorIntelligence(contractorId);
      return;
    }

    try {
      const aiResult = await validateDocument({ storagePath, documentType });
      const expiresAt = parseExpiryDateToTimestamp(aiResult.extractedFields.expiryDate);
      const isExpired = typeof expiresAt === "number" ? expiresAt <= Date.now() : false;
      const validationError =
        aiResult.valid && !isExpired
          ? null
          : aiResult.issues.join("; ") || (isExpired ? "Document is expired" : "AI validation failed");

      logger.info("document intelligence ai result", {
        contractorId,
        docType,
        valid: aiResult.valid,
        confidenceScore: aiResult.confidenceScore,
        issues: aiResult.issues,
        fraudIndicators: aiResult.fraudIndicators,
        expiresAt,
        isExpired,
      });

      await documentRef.set(
        {
          aiStatus: "complete",
          aiError: null,
          aiValidated: true,
          aiData: aiResult,
          confidenceScore: aiResult.confidenceScore,
          issues: aiResult.issues,
          extractedFields: {
            registrationNumber: aiResult.extractedFields.registrationNumber || null,
            expiryDate: aiResult.extractedFields.expiryDate || null,
            companyName: aiResult.extractedFields.companyName || null,
          },
          expiryDate: expiresAt,
          expiresAt,
          isExpired,
          validationError,
          verified: aiResult.valid && !isExpired,
          status: aiResult.valid ? (isExpired ? "expired" : "verified") : "uploaded",
          updatedAt: new Date(),
        },
        { merge: true }
      );

      logger.info("document intelligence firestore update complete", {
        contractorId,
        docType,
        path: documentRef.path,
      });
    } catch (error) {
      const aiError = error instanceof Error ? error.message : "Unknown AI validation error";

      logger.error("document intelligence failed", {
        contractorId,
        docType,
        path: documentRef.path,
        aiError,
      });

      await documentRef.set(
        {
          aiStatus: "failed",
          aiError,
          aiValidated: false,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    await updateContractorIntelligence(contractorId);
  }
);
