const admin = require("firebase-admin");
const OpenAI = require("openai");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

const REQUIRED_DOCS = ["cipc", "tax", "bbbee", "coida", "bank"];
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

function normalizeDocumentTypeToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toLegacyRequirementKey(value) {
  const normalized = normalizeDocumentTypeToken(value);

  switch (normalized) {
    case "cipc":
      return "cipc";
    case "bbbee":
    case "bbee":
      return "bbbee";
    case "tax":
    case "taxclearance":
    case "taxcompliance":
      return "tax";
    case "coida":
      return "coida";
    case "bank":
    case "bankconfirmation":
    case "bankletter":
      return "bank";
    default:
      return null;
  }
}

function extractJsonPayload(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced && fenced[1] ? fenced[1] : content).trim();
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

function summarizeExtractedFields(fields) {
  if (!fields || typeof fields !== "object") {
    return {
      isEmpty: true,
      keys: [],
      registrationNumber: null,
      expiryDate: null,
      companyName: null,
    };
  }

  const registrationNumber = normalizeString(fields.registrationNumber) || null;
  const expiryDate = normalizeString(fields.expiryDate) || null;
  const companyName = normalizeString(fields.companyName) || null;
  const keys = Object.keys(fields).filter((key) => normalizeString(fields[key]));

  return {
    isEmpty: keys.length === 0,
    keys,
    registrationNumber,
    expiryDate,
    companyName,
  };
}

function determineVerificationFailureReason(aiResult, extractedFieldsSummary, expiresAt, isExpired) {
  if (aiResult.valid !== true) {
    return "aiResult.valid_false";
  }

  if (extractedFieldsSummary.isEmpty) {
    return "empty_extraction_payload";
  }

  if (aiResult.confidenceScore === 0 && aiResult.issues.includes("No readable text extracted from document")) {
    return "ocr_failure";
  }

  if (
    extractedFieldsSummary.keys.length === 0 &&
    (aiResult.issues.includes("AI validation returned an empty response") ||
      aiResult.issues.includes("AI validation returned an invalid payload"))
  ) {
    return "invalid_normalization";
  }

  if (!extractedFieldsSummary.expiryDate && extractedFieldsSummary.keys.length > 0) {
    return "missing_extracted_fields";
  }

  if (extractedFieldsSummary.expiryDate && expiresAt === null) {
    return "expiry_parsing_failure";
  }

  if (isExpired) {
    return "document_expired";
  }

  return null;
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
  const contractorRef = db.collection("contractors").doc(contractorId);
  const contractorSnapshot = await contractorRef.get();
  const readinessBefore = {
    readinessScore: contractorSnapshot.data()?.readinessScore ?? null,
    docsMissing: contractorSnapshot.data()?.docsMissing ?? null,
    complianceApproved: contractorSnapshot.data()?.complianceApproved ?? null,
    tenderLockStatus: contractorSnapshot.data()?.tenderLockStatus ?? null,
    isTenderLocked: contractorSnapshot.data()?.isTenderLocked ?? null,
  };
  const documentsSnapshot = await db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  const documents = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

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
  const documentsState = {
    cipc: { uploaded: false, valid: false, status: "missing" },
    tax: { uploaded: false, valid: false, status: "missing" },
    bbbee: { uploaded: false, valid: false, status: "missing" },
    coida: { uploaded: false, valid: false, status: "missing" },
    bank: { uploaded: false, valid: false, status: "missing" },
  };

  documents.forEach((document) => {
    const key = toLegacyRequirementKey(document.documentType || document.docType || document.id);
    if (!key) {
      return;
    }

    const uploaded = hasUploadedFile(document);
    const valid = document.verified === true && document.isExpired !== true;
    const status = valid
      ? "verified"
      : document.isExpired === true
        ? "expired"
        : uploaded
          ? "uploaded"
          : "missing";
    const current = documentsState[key];
    const currentRank = current.valid ? 2 : current.uploaded ? 1 : 0;
    const nextRank = valid ? 2 : uploaded ? 1 : 0;

    if (nextRank >= currentRank) {
      documentsState[key] = { uploaded, valid, status };
    }
  });
  const completed = Object.entries(documentsState)
    .filter(([, document]) => document.valid === true)
    .map(([key]) => key);
  const missing = Object.entries(documentsState)
    .filter(([, document]) => document.valid !== true)
    .map(([key]) => key);
  const complianceScore = Math.round((completed.length / REQUIRED_DOCS.length) * 100);
  const complianceStatus =
    complianceScore === 100 ? "complete" : complianceScore >= 60 ? "partial" : "risk";
  const readinessScore = Math.round(complianceScore * 0.6 + documentQualityScore * 0.4);
  const readinessStatus = readinessScore >= 80 ? "READY" : readinessScore >= 60 ? "RISK" : "BLOCKED";
  const docsMissing = Object.values(documentsState).filter((document) => document.valid !== true).length;
  const complianceApproved =
    docsMissing === 0 &&
    documentsState.cipc.valid === true &&
    documentsState.tax.valid === true &&
    documentsState.bbbee.valid === true &&
    documentsState.coida.valid === true &&
    documentsState.bank.valid === true;

  await contractorRef.set(
      {
        complianceScore,
        complianceCompleted: completed.length,
        complianceCompletedTypes: completed,
        complianceMissing: missing.length,
        complianceMissingTypes: missing,
        complianceStatus,
        documentQualityScore,
        readinessScore,
        readinessStatus,
        docsMissing,
        isTenderLocked: docsMissing > 0 || readinessScore < 80,
        tenderLockStatus: docsMissing > 0 ? "BLOCKED" : readinessStatus,
        complianceApproved,
        documents: documentsState,
        updatedAt: new Date(),
      },
      { merge: true }
    );

  const readinessAfter = {
    readinessScore,
    docsMissing,
    complianceApproved,
    tenderLockStatus: docsMissing > 0 ? "BLOCKED" : readinessStatus,
    isTenderLocked: docsMissing > 0 || readinessScore < 80,
  };

  return { readinessBefore, readinessAfter };
}

exports.onContractorDocumentCreated = onDocumentWritten(
  {
    document: "contractors/{contractorId}/documents/{docType}",
    region: REGION,
  },
  async (event) => {
    const change = event.data;
    if (!change || !change.after) {
      logger.warn("Document trigger fired without snapshot data");
      return;
    }

    const contractorId = event.params.contractorId;
    const docType = event.params.docType;
    const beforeSnapshot = change.before;
    const afterSnapshot = change.after;
    const documentRef = afterSnapshot.ref;
    const beforeData = beforeSnapshot && beforeSnapshot.exists ? beforeSnapshot.data() || {} : {};
    const currentData = afterSnapshot.exists ? afterSnapshot.data() || {} : {};
    const triggerType = !beforeSnapshot.exists ? "create" : !afterSnapshot.exists ? "delete" : "update";

    logger.info("document intelligence trigger start", {
      contractorId,
      docType,
      triggerType,
      path: documentRef.path,
    });

    if (!afterSnapshot.exists) {
      logger.info("document intelligence skipped: document deleted", {
        contractorId,
        docType,
        triggerType,
        path: documentRef.path,
      });
      return;
    }

    const storagePath = normalizeString(currentData.storagePath);
    const documentType = normalizeString(currentData.documentType) || docType;
    const previousStoragePath = normalizeString(beforeData.storagePath);
    const storagePathChanged = previousStoragePath !== storagePath;
    const shouldVerify =
      Boolean(storagePath) &&
      currentData.verified !== true &&
      (currentData.aiStatus === "pending" || !beforeSnapshot.exists || storagePathChanged);
    let verified = currentData.verified === true;

    if (!storagePath && shouldVerify) {
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
        documentType,
        triggerType,
        path: documentRef.path,
      });

      const syncResult = await updateContractorIntelligence(contractorId);
      logger.info("document intelligence sync complete", {
        contractorId,
        documentType,
        triggerType,
        verified: false,
        readinessBefore: syncResult.readinessBefore,
        readinessAfter: syncResult.readinessAfter,
      });
      return;
    }

    if (shouldVerify) {
      try {
        const aiResult = await validateDocument({ storagePath, documentType });
        const extractedFieldsSummary = summarizeExtractedFields(aiResult.extractedFields);
        const expiresAt = parseExpiryDateToTimestamp(aiResult.extractedFields.expiryDate);
        const isExpired = typeof expiresAt === "number" ? expiresAt <= Date.now() : false;
        const verificationFailureReason = determineVerificationFailureReason(
          aiResult,
          extractedFieldsSummary,
          expiresAt,
          isExpired
        );
        const validationError =
          aiResult.valid && !isExpired
            ? null
            : aiResult.issues.join("; ") || (isExpired ? "Document is expired" : "AI validation failed");
        const contractorSnapshotBefore = await documentRef.parent.parent.get();
        const contractorDataBefore = contractorSnapshotBefore.data() || {};
        const readinessBefore = {
          readinessScore: contractorDataBefore.readinessScore ?? null,
          docsMissing: contractorDataBefore.docsMissing ?? null,
          complianceApproved: contractorDataBefore.complianceApproved ?? null,
          tenderLockStatus: contractorDataBefore.tenderLockStatus ?? null,
          isTenderLocked: contractorDataBefore.isTenderLocked ?? null,
        };

        logger.info("document intelligence ai result", {
          contractorId,
          docType,
          documentType,
          triggerType,
          valid: aiResult.valid,
          confidenceScore: aiResult.confidenceScore,
          issues: aiResult.issues,
          fraudIndicators: aiResult.fraudIndicators,
          expiresAt,
          isExpired,
          extractedFields: extractedFieldsSummary,
          verificationResult: {
            verified: aiResult.valid && !isExpired,
            failureReason: verificationFailureReason,
            validationError,
          },
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
        verified = aiResult.valid && !isExpired;

        const verificationSnapshot = await documentRef.get();
        const verificationData = verificationSnapshot.data() || {};

        logger.info("document intelligence firestore update complete", {
          contractorId,
          docType,
          documentType,
          triggerType,
          path: documentRef.path,
          aiValid: aiResult.valid,
          isExpired,
          extractedFields: extractedFieldsSummary,
          verificationResult: {
            verified,
            failureReason: verificationFailureReason,
            validationError,
          },
          firestoreState: {
            verified: verificationData.verified === true,
            status: verificationData.status || null,
            aiStatus: verificationData.aiStatus || null,
            validationError: verificationData.validationError || null,
          },
          readinessBefore,
        });
      } catch (error) {
        const aiError = error instanceof Error ? error.message : "Unknown AI validation error";

        logger.error("document intelligence failed", {
          contractorId,
          docType,
          documentType,
          triggerType,
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
    } else {
      logger.info("document intelligence skipped: verification not required", {
        contractorId,
        docType,
        documentType,
        triggerType,
        path: documentRef.path,
      });
    }

    const persistedSnapshot = await documentRef.get();
    const persistedData = persistedSnapshot.data() || {};
    const syncResult = await updateContractorIntelligence(contractorId);
    logger.info("document intelligence verification trace", {
      contractorId,
      documentType,
      aiValid: persistedData.aiData && persistedData.aiData.valid === true,
      isExpired: persistedData.isExpired === true,
      extractedFields: summarizeExtractedFields(persistedData.extractedFields),
      verificationResult: {
        verified: persistedData.verified === true,
        validationError: persistedData.validationError || null,
        aiStatus: persistedData.aiStatus || null,
        status: persistedData.status || null,
      },
      readinessBefore: syncResult.readinessBefore,
      readinessAfter: syncResult.readinessAfter,
    });
    logger.info("document intelligence sync complete", {
      contractorId,
      documentType,
      triggerType,
      verified,
      readinessBefore: syncResult.readinessBefore,
      readinessAfter: syncResult.readinessAfter,
    });
  }
);
