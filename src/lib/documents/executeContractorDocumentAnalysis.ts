import { logActivity } from "@/lib/activity/logActivity";
import {
  isSupportedDocumentType,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { applyVerificationAuditTrail } from "@/lib/documents/verificationAuditTrail";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { recordDocumentExtractionDiagnostic } from "@/lib/pdf/documentExtractionDiagnostics";
import { AUTHORITY_CLASSIFICATIONS, ROUTE_CLASSIFICATIONS } from "@/lib/governance/classification";
import { createGovernanceContext, type GovernanceContext } from "@/lib/governance/context";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(/[\n,;|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizeStoragePath(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice("gs://".length);
    const slashIndex = withoutScheme.indexOf("/");
    const resolved = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return resolved.trim() || null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.includes("/o/")) {
        return null;
      }

      const encodedPath = parsed.pathname.split("/o/")[1] ?? "";
      const decoded = decodeURIComponent(encodedPath);
      return decoded.trim() || null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

function normalizeExtractedFields(fields: Record<string, string | null> | undefined) {
  const extractedFields = { ...(fields ?? {}) };

  if (!("registrationNumber" in extractedFields) && extractedFields.companyRegistrationNumber) {
    extractedFields.registrationNumber = extractedFields.companyRegistrationNumber;
  }

  if (!("registrationNumber" in extractedFields) && extractedFields.employerRegistrationNumber) {
    extractedFields.registrationNumber = extractedFields.employerRegistrationNumber;
  }

  return extractedFields;
}

function pickField(fields: Record<string, string | null>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function buildContractorProfileSyncUpdates(args: {
  documentType: SupportedDocumentType;
  fields: Record<string, string | null>;
  storagePath: string;
  updatedAt: Date;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    lastDocumentUpdateAt: args.updatedAt.toISOString(),
    lastDocumentType: args.documentType,
    lastDocumentStoragePath: args.storagePath,
    updatedAt: args.updatedAt.toISOString(),
  };
  const registrationNumber = pickField(args.fields, [
    "registrationNumber",
    "companyRegistrationNumber",
    "employerRegistrationNumber",
  ]);
  const csdNumber = pickField(args.fields, ["csdNumber", "csdMNumber", "mNumber"]);

  if (registrationNumber) {
    updates.registrationNumber = registrationNumber;
    updates.companyRegistrationNumber = registrationNumber;
  }

  if (csdNumber) {
    updates.csdNumber = csdNumber;
    updates.csdMNumber = csdNumber;
    updates.mNumber = csdNumber;
  }

  if (args.documentType === "taxClearance") {
    const tcsPinLastFour = pickField(args.fields, ["tcsPinLastFour", "pinLastFour"]);
    const taxNumber = pickField(args.fields, ["taxNumber", "taxpayerReference", "taxReferenceNumber"]);
    const taxpayerName = pickField(args.fields, ["taxpayerName", "companyName"]);

    if (tcsPinLastFour) {
      updates.tcsPinLastFour = tcsPinLastFour;
      updates.taxPinStatus = "PIN extracted - staff review required";
    }
    if (taxNumber) {
      updates.taxNumber = taxNumber;
      updates.taxReferenceNumber = taxNumber;
    }
    if (taxpayerName) {
      updates.taxpayerName = taxpayerName;
    }
  }

  if (args.documentType === "cipc" && registrationNumber) {
    const companyName = pickField(args.fields, ["companyName"]);
    if (companyName) {
      updates.registeredCompanyName = companyName;
    }
  }

  if (args.documentType === "bbbee") {
    const beeLevel = pickField(args.fields, ["beeLevel"]);
    if (beeLevel) {
      updates.bbbeeLevel = beeLevel;
    }
  }

  if (args.documentType === "coida") {
    const coidaRegistrationNumber = pickField(args.fields, ["employerRegistrationNumber", "registrationNumber"]);
    if (coidaRegistrationNumber) {
      updates.coidaRegistrationNumber = coidaRegistrationNumber;
    }
  }

  if (args.documentType === "bankConfirmation") {
    const bankName = pickField(args.fields, ["bankName"]);
    const accountHolder = pickField(args.fields, ["accountHolder"]);
    const accountNumber = pickField(args.fields, ["accountNumber"]);
    const branchCode = pickField(args.fields, ["branchCode"]);

    if (bankName) updates.bankName = bankName;
    if (accountHolder) updates.bankAccountHolder = accountHolder;
    if (accountNumber) updates.bankAccountNumber = accountNumber;
    if (branchCode) updates.bankBranchCode = branchCode;
  }

  return updates;
}

function buildVerificationPersistence(
  result: Awaited<ReturnType<typeof verifyStoredContractorDocument>>,
  actorEmail?: string | null
) {
  const verifiedAt = result.verified ? new Date().toISOString() : null;

  return {
    aiStatus: "complete" as const,
    aiError: null,
    aiValidated: result.verified === true,
    validationStatus: result.status,
    confidenceScore: result.score,
    missingFields: result.missingFields,
    confidenceNotes: result.confidenceNotes ?? [],
    suggestions: result.suggestions,
    reviewReason: result.reason ?? null,
    validationError: result.status === "FAIL" ? result.reason ?? "Automatic verification failed" : null,
    manualDecisionAvailable: result.status === "REVIEW",
    verified: result.verified,
    verifiedAt,
    verifiedBy: result.verified ? actorEmail?.trim() || "unknown" : null,
    status: result.status === "PASS" ? "verified" : result.status === "FAIL" ? "invalid" : "uploaded",
    taxDocumentCategory: result.taxClassification?.category ?? null,
    taxDocumentPurpose: result.taxClassification?.purpose ?? null,
    taxClassificationConfidence: result.taxClassification?.confidence ?? null,
    taxComplianceCapable: result.taxClassification?.complianceCapable ?? null,
    taxSupportingOnly: result.taxClassification?.supportingOnly ?? null,
    readinessImpactReason: result.taxClassification?.readinessImpactReason ?? null,
    extractionSource: result.extractionSource ?? null,
    extractionMethod: result.extractionSource === "OCR" ? "ocr" : result.extractionSource === "PDF_TEXT" ? "pdf-parse" : null,
    extractedTextLength: result.extractedTextLength ?? 0,
    directTextLength: result.directTextLength ?? 0,
    ocrTextLength: result.ocrTextLength ?? 0,
    pageCount: result.pageCount ?? 0,
  };
}

async function downloadContractorDocumentBuffer(args: {
  storagePath: string;
  contractorId: string;
  documentType: SupportedDocumentType;
  fileName: string;
  diagnosticId?: string | null;
}): Promise<Buffer> {
  const startedAt = Date.now();
  await recordDocumentExtractionDiagnostic({
    diagnosticId: args.diagnosticId ?? undefined,
    contractorId: args.contractorId,
    documentType: args.documentType,
    storagePath: args.storagePath,
    fileName: args.fileName,
    step: "UPLOAD",
    enteredAt: new Date().toISOString(),
    metadata: { stage: "storage_download_start" },
  });
  const bucket = getFirebaseStorageBucket();
  try {
    const [buffer] = await bucket.file(args.storagePath).download();
    const fileBuffer = Buffer.from(buffer);

    console.log("[PDF_DOWNLOAD]", {
      storagePath: args.storagePath,
      bytes: fileBuffer.length,
    });

    console.log("[PDF_DOWNLOAD_SUCCESS]", {
      storagePath: args.storagePath,
      bytes: fileBuffer.length,
    });

    console.log("[PDF_BYTES_LENGTH]", {
      storagePath: args.storagePath,
      bytes: fileBuffer.length,
    });

    await recordDocumentExtractionDiagnostic({
      diagnosticId: args.diagnosticId ?? undefined,
      contractorId: args.contractorId,
      documentType: args.documentType,
      storagePath: args.storagePath,
      fileName: args.fileName,
      step: "UPLOAD",
      exitedAt: new Date().toISOString(),
      success: true,
      timingMs: Date.now() - startedAt,
      metadata: { stage: "storage_download_complete", bytes: fileBuffer.length },
    });

    return fileBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordDocumentExtractionDiagnostic({
      diagnosticId: args.diagnosticId ?? undefined,
      contractorId: args.contractorId,
      documentType: args.documentType,
      storagePath: args.storagePath,
      fileName: args.fileName,
      step: "UPLOAD",
      exitedAt: new Date().toISOString(),
      success: false,
      errorMessage,
      timingMs: Date.now() - startedAt,
      metadata: { stage: "storage_download_failed" },
    });
    throw error;
  }
}

export async function executeContractorDocumentAnalysis(params: {
  contractorId: string;
  documentType: string;
  actorEmail?: string | null;
  actorId?: string | null;
  writeActivity?: boolean;
  governanceContext?: GovernanceContext;
}) {
  const db = getFirebaseAdmin();
  const contractorId = params.contractorId.trim();
  const documentType = params.documentType.trim();
  const governanceContext = params.governanceContext ?? createGovernanceContext({
    actor: {
      actorId: params.actorId ?? null,
      actorEmail: params.actorEmail ?? null,
      actorRole: null,
    },
    route: {
      sourceName: "executeContractorDocumentAnalysis",
      sourceType: "service",
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
    },
  });
  const startedAt = Date.now();

  if (!contractorId) {
    throw new Error("Missing contractorId");
  }

  if (!isSupportedDocumentType(documentType)) {
    throw new Error("Unsupported documentType");
  }

  console.log("[DOCUMENT_ANALYSIS_STARTED]", {
    source: "executeContractorDocumentAnalysis",
    contractorId,
    documentId: documentType,
    documentType,
  });

  emitGovernanceEvent({
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: new Date().toISOString(),
    category: "ai_analysis",
    eventType: "canonical_document_analysis_started",
    correlation: {
      correlationId: governanceContext.correlationId,
      requestId: governanceContext.requestId,
    },
    actor: {
      actorId: governanceContext.actor.actorId ?? null,
      actorEmail: governanceContext.actor.actorEmail ?? null,
      actorRole: governanceContext.actor.actorRole ?? null,
    },
    source: {
      sourceType: "service",
      sourceName: "executeContractorDocumentAnalysis",
      routePath: governanceContext.route.routePath ?? null,
      method: governanceContext.route.method ?? null,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
    },
    entity: {
      entityType: "contractorDocument",
      entityId: documentType,
      contractorId,
      documentType,
    },
    governance: {
      routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
      failOpen: true,
    },
  });

  const documentRef = db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType);

  const documentSnapshot = await documentRef.get();
  if (!documentSnapshot.exists) {
    throw new Error("Document not found");
  }
  const contractorSnapshot = await db.collection("contractors").doc(contractorId).get();
  const contractorData = (contractorSnapshot.data() ?? {}) as Record<string, unknown>;

  const metadata = (documentSnapshot.data() ?? {}) as Record<string, unknown>;
  const storagePathSource =
    asString(metadata.storagePath) ??
    asString(metadata.filePath) ??
    asString(metadata.downloadURL) ??
    asString(metadata.downloadUrl) ??
    asString(metadata.fileUrl) ??
    asString(metadata.url);
  const storagePath = storagePathSource ? normalizeStoragePath(storagePathSource) : null;

  if (!storagePath) {
    throw new Error("Document is missing storagePath");
  }

  try {
    const fileName = storagePath.split("/").filter(Boolean).pop() ?? `${documentType}.pdf`;
    const diagnosticId = `${contractorId}_${documentType}_${Date.now()}`;
    const buffer = await downloadContractorDocumentBuffer({
      storagePath,
      contractorId,
      documentType: documentType as SupportedDocumentType,
      fileName,
      diagnosticId,
    });
    const analysisStepStartedAt = Date.now();
    await recordDocumentExtractionDiagnostic({
      diagnosticId,
      contractorId,
      documentType,
      storagePath,
      fileName,
      step: "ANALYSIS_EXECUTION",
      enteredAt: new Date().toISOString(),
      metadata: { source: "executeContractorDocumentAnalysis" },
    });
    const result = await verifyStoredContractorDocument(buffer, documentType as SupportedDocumentType, {
      companyName:
        asString(contractorData.companyName) ??
        asString(contractorData.name),
      registrationNumber:
        asString(contractorData.registrationNumber) ??
        asString(contractorData.companyRegistrationNumber),
      contactPerson:
        asString(contractorData.contactPerson) ??
        asString(contractorData.directorName) ??
        asString(contractorData.contactName),
      relatedParties: [
        ...asStringArray(contractorData.directorNames),
        ...asStringArray(contractorData.directors),
        ...asStringArray(contractorData.contactPerson),
        ...asStringArray(contractorData.directorName),
        ...asStringArray(contractorData.contactName),
      ],
      extractionDiagnostics: {
        contractorId,
        documentType,
        storagePath,
        fileName,
        diagnosticId,
      },
    });
    await recordDocumentExtractionDiagnostic({
      diagnosticId,
      contractorId,
      documentType,
      storagePath,
      fileName,
      step: "ANALYSIS_EXECUTION",
      exitedAt: new Date().toISOString(),
      success: true,
      timingMs: Date.now() - analysisStepStartedAt,
      pdfTextLength: result.directTextLength ?? 0,
      ocrTextLength: result.ocrTextLength ?? 0,
      pageCount: result.pageCount ?? 0,
      finalExtractionSource: result.extractionSource ?? null,
    });
    const extractedFields = normalizeExtractedFields(
      result.extractedFields as Record<string, string | null> | undefined
    );
    const verificationPersistence = buildVerificationPersistence(result, params.actorEmail);
    const auditActor = params.actorEmail?.trim() || params.actorId || "unknown";
    const verificationAudit = result.verified && verificationPersistence.verifiedAt
      ? applyVerificationAuditTrail({
          existingAuditTrail: metadata.auditTrail,
          metadata,
          candidate: {
            actor: auditActor,
            at: verificationPersistence.verifiedAt,
            source: "ai_verification",
            verificationStatus: result.status,
            aiStatus: verificationPersistence.aiStatus,
            extractedFields,
          },
        })
      : {
          auditTrail: Array.isArray(metadata.auditTrail) ? metadata.auditTrail : [],
          appended: false,
          skippedDuplicate: false,
          duplicateReason: null,
        };
    const auditTrail = verificationAudit.auditTrail;

    console.log("[AI_ANALYSIS_COMPLETE]", {
      contractorId,
      documentId: documentType,
      documentType,
      validationStatus: result.status,
      verified: result.verified,
      confidenceScore: result.score,
      missingFields: result.missingFields,
      directTextLength: result.directTextLength ?? 0,
      ocrTextLength: result.ocrTextLength ?? 0,
      extractedTextLength: result.extractedTextLength ?? 0,
      extractionSource: result.extractionSource ?? null,
    });

    if (verificationAudit.skippedDuplicate) {
      const logMethod = verificationAudit.duplicateReason === "ambiguous_replay" ? console.warn : console.info;
      logMethod("[verification-audit] skipped_duplicate_write", {
        contractorId,
        documentType,
        reason: verificationAudit.duplicateReason,
        actor: auditActor,
        validationStatus: result.status,
      });
    }

    const analysisUpdatedAt = new Date();
    await documentRef.set(
      {
        ...verificationPersistence,
        auditTrail,
        extractedFields,
        analysisTimestamp: Date.now(),
        updatedAt: analysisUpdatedAt,
      },
      { merge: true }
    );

    await db.collection("contractors").doc(contractorId).set(
      buildContractorProfileSyncUpdates({
        documentType: documentType as SupportedDocumentType,
        fields: extractedFields,
        storagePath,
        updatedAt: analysisUpdatedAt,
      }),
      { merge: true },
    );

    const persistedSnapshot = await documentRef.get();
    const persistedData = (persistedSnapshot.data() ?? {}) as Record<string, unknown>;

    console.log("[DOCUMENT_EXTRACTION_EVIDENCE]", {
      contractorId,
      documentId: persistedSnapshot.id,
      documentType,
      storagePath,
      validationStatus: result.status,
      reviewReason: result.reason ?? null,
      directTextLength: result.directTextLength ?? 0,
      ocrTextLength: result.ocrTextLength ?? 0,
      extractedTextLength: result.extractedTextLength ?? 0,
      extractionSource: result.extractionSource ?? null,
      extractedFieldKeys: Object.keys(extractedFields),
      verificationAnalysisReached: (result.extractedTextLength ?? 0) > 0,
    });

    console.log("[DOC_VERIFY_WRITEBACK]", {
      contractorId,
      documentType,
      persistedVerified: persistedData.verified ?? null,
      persistedValidationStatus: persistedData.validationStatus ?? null,
      persistedStatus: persistedData.status ?? null,
    });

    if (result.verified === true && persistedData.verified !== true) {
      throw new Error("Verification writeback mismatch");
    }

    const summary = await recalculateContractorCompliance(db, contractorId, governanceContext);

    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "ai_analysis",
      eventType: "canonical_document_analysis_completed",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: governanceContext.actor.actorId ?? null,
        actorEmail: governanceContext.actor.actorEmail ?? null,
        actorRole: governanceContext.actor.actorRole ?? null,
      },
      source: {
        sourceType: "service",
        sourceName: "executeContractorDocumentAnalysis",
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? null,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      },
      entity: {
        entityType: "contractorDocument",
        entityId: persistedSnapshot.id,
        contractorId,
        documentType,
      },
      mutation: {
        mutatedFields: ["aiStatus", "validationStatus", "verified", "verifiedAt", "verifiedBy", "status"],
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
        latencyMs: Date.now() - startedAt,
        failOpen: true,
      },
      ai: {
        aiStatus: "complete",
        validationStatus: result.status,
        confidenceScore: result.score,
        warnings: result.missingFields,
      },
    });

    if (params.writeActivity !== false) {
      await logActivity({
        contractorId,
        action: `AI analyzed ${documentType} (${result.status})`,
        performedBy: params.actorEmail?.trim() || params.actorId || "system",
      });
    }

    return {
      result,
      summary,
      extractedFields,
      documentId: persistedSnapshot.id,
      persistedData,
    };
  } catch (error) {
    await documentRef.set(
      {
        aiStatus: "failed",
        aiError: error instanceof Error ? error.message : "Document analysis failed",
        updatedAt: new Date(),
      },
      { merge: true }
    );
    await db.collection("contractors").doc(contractorId).set(
      {
        lastDocumentUpdateAt: new Date().toISOString(),
        lastDocumentType: documentType,
        lastDocumentStoragePath: storagePath ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    emitGovernanceEvent({
      eventId: crypto.randomUUID(),
      eventVersion: "v1",
      occurredAt: new Date().toISOString(),
      category: "ai_analysis",
      eventType: "canonical_document_analysis_failed",
      correlation: {
        correlationId: governanceContext.correlationId,
        requestId: governanceContext.requestId,
      },
      actor: {
        actorId: governanceContext.actor.actorId ?? null,
        actorEmail: governanceContext.actor.actorEmail ?? null,
        actorRole: governanceContext.actor.actorRole ?? null,
      },
      source: {
        sourceType: "service",
        sourceName: "executeContractorDocumentAnalysis",
        routePath: governanceContext.route.routePath ?? null,
        method: governanceContext.route.method ?? null,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
      },
      entity: {
        entityType: "contractorDocument",
        entityId: documentType,
        contractorId,
        documentType,
      },
      governance: {
        routeClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        sourceClassification: ROUTE_CLASSIFICATIONS.CANONICAL,
        authorityClassification: AUTHORITY_CLASSIFICATIONS.SOURCE_OF_TRUTH,
        latencyMs: Date.now() - startedAt,
        failOpen: true,
      },
      ai: {
        aiStatus: "failed",
        failureReason: error instanceof Error ? error.message : "Document analysis failed",
      },
    });

    throw error;
  }
}
