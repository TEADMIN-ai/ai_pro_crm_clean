import crypto from "node:crypto";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { buildVehicleFinanceBankStatementIntelligence } from "./bankStatementIntelligence";
import type {
  VehicleFinanceBankStatementIntelligenceJob,
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
} from "@/types/vehicleFinance";
import {
  VEHICLE_FINANCE_BANK_STATEMENT_INTELLIGENCE_JOB_COLLECTION,
  VEHICLE_FINANCE_DOCUMENT_TYPES,
} from "@/types/vehicleFinance";

const DOCUMENT_COLLECTION = "vehicleFinanceDocuments";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toIso(value: unknown, fallback = Date.now()): string {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return new Date(Number.isFinite(parsed) ? parsed : fallback).toISOString();
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return new Date(Number.isFinite(millis) ? millis : fallback).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return new Date(fallback).toISOString();
}

function normalizeDocumentData(id: string, data: Record<string, unknown>): VehicleFinanceDocument {
  return {
    documentId: id,
    applicationId: asString(data.applicationId),
    documentType: asString(data.documentType) as (typeof VEHICLE_FINANCE_DOCUMENT_TYPES)[number],
    filePath: asString(data.filePath),
    fileName: asString(data.fileName),
    extractedText: asString(data.extractedText),
    aiAnalysis: (data.aiAnalysis as VehicleFinanceDocumentAnalysis | Record<string, unknown>) ?? {},
    uploadedAt: toIso(data.uploadedAt),
    directTextLength: asNumber(data.directTextLength),
    ocrTextLength: asNumber(data.ocrTextLength),
    extractedTextLength: asNumber(data.extractedTextLength),
    pageCount: asNumber(data.pageCount),
    extractionSource: (asString(data.extractionSource) || "EMPTY") as VehicleFinanceDocument["extractionSource"],
  };
}

function getJobRef(jobId: string) {
  return getFirebaseAdmin().collection(VEHICLE_FINANCE_BANK_STATEMENT_INTELLIGENCE_JOB_COLLECTION).doc(jobId);
}

export async function getVehicleFinanceBankStatementIntelligenceDocument(documentId: string): Promise<VehicleFinanceDocument | null> {
  const snapshot = await getFirebaseAdmin().collection(DOCUMENT_COLLECTION).doc(documentId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeDocumentData(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

async function updateVehicleFinanceDocumentIntelligence(
  documentId: string,
  update: Partial<VehicleFinanceDocument> & {
    aiAnalysis?: VehicleFinanceDocumentAnalysis | Record<string, unknown>;
  },
) {
  await getFirebaseAdmin()
    .collection(DOCUMENT_COLLECTION)
    .doc(documentId)
    .set(
      {
        ...update,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

export async function createVehicleFinanceBankStatementIntelligenceJob(applicationId: string, documentId: string) {
  const jobId = `${documentId}-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const job: VehicleFinanceBankStatementIntelligenceJob = {
    jobId,
    applicationId,
    documentId,
    status: "QUEUED",
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    resultDocumentId: null,
  };

  await getJobRef(jobId).set(job);
  return job;
}

async function getVehicleFinanceBankStatementIntelligenceJob(jobId: string): Promise<VehicleFinanceBankStatementIntelligenceJob | null> {
  const snapshot = await getJobRef(jobId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    jobId: snapshot.id,
    ...(snapshot.data() ?? {}),
  } as VehicleFinanceBankStatementIntelligenceJob;
}

async function updateVehicleFinanceBankStatementIntelligenceJob(
  jobId: string,
  update: Partial<VehicleFinanceBankStatementIntelligenceJob>,
) {
  await getJobRef(jobId).set(
    {
      ...update,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function claimVehicleFinanceBankStatementIntelligenceJob(jobId: string) {
  const jobRef = getJobRef(jobId);
  const timestamp = new Date().toISOString();

  return getFirebaseAdmin().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) {
      return null;
    }

    const job = snapshot.data() as VehicleFinanceBankStatementIntelligenceJob;
    if (job.status !== "QUEUED") {
      return null;
    }

    transaction.set(
      jobRef,
      {
        status: "PROCESSING",
        startedAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );

    return {
      ...job,
      status: "PROCESSING" as const,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export async function processVehicleFinanceBankStatementIntelligenceJob(jobId: string) {
  const claimedJob = await claimVehicleFinanceBankStatementIntelligenceJob(jobId);
  if (!claimedJob) {
    return null;
  }

  const job = await getVehicleFinanceBankStatementIntelligenceJob(jobId);
  if (!job) {
    return null;
  }

  console.log("[vehicle-finance] bank statement intelligence job started", {
    jobId,
    applicationId: job.applicationId,
    documentId: job.documentId,
  });

  const document = await getVehicleFinanceBankStatementIntelligenceDocument(job.documentId);
  if (!document) {
    const errorMessage = "Vehicle finance document not found";
    await updateVehicleFinanceBankStatementIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage,
    });
    console.log("[vehicle-finance] bank statement intelligence job failed", {
      jobId,
      applicationId: job.applicationId,
      documentId: job.documentId,
      error: errorMessage,
    });
    return null;
  }

  const storageBucket = getFirebaseStorageBucket();
  const file = storageBucket.file(document.filePath);
  const [fileBuffer] = await file.download();

  const intelligence = await buildVehicleFinanceBankStatementIntelligence({
    documentType: document.documentType,
    extractedText: document.extractedText,
    fileBuffer: Buffer.from(fileBuffer),
    filename: document.fileName,
    pageCount: document.pageCount,
    documentIntegrityScore:
      typeof (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.documentIntegrityScore === "number"
        ? ((document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>).documentIntegrityScore as number)
        : 0,
  });

  if (!intelligence) {
    await updateVehicleFinanceBankStatementIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage: "Vehicle finance bank statement intelligence was not generated",
    });
    return null;
  }

  const updatedText = intelligence.selectedText.trim() || document.extractedText.trim();
  const updatedExtractionSource = intelligence.selectedText.trim() && updatedText !== document.extractedText.trim() ? "OCR" : document.extractionSource;
  const existingAnalysis = (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>) ?? {};
  const updatedAiAnalysis: VehicleFinanceDocumentAnalysis = {
    documentType: document.documentType,
    extractedTextLength: updatedText.length,
    directTextLength: document.directTextLength,
    ocrTextLength: updatedExtractionSource === "OCR" ? updatedText.length : document.ocrTextLength,
    pageCount: document.pageCount,
    extractionSource: updatedExtractionSource,
    documentIntegrityScore: existingAnalysis.documentIntegrityScore ?? 0,
    fraudIndicators: existingAnalysis.fraudIndicators ?? [],
    integrityNotes: existingAnalysis.integrityNotes ?? [],
    textQualityAssessment: existingAnalysis.textQualityAssessment ?? null,
    documentClassification: intelligence.classification,
    bankStatementIntelligence: intelligence,
  };

  await updateVehicleFinanceDocumentIntelligence(document.documentId, {
    extractedText: updatedText,
    directTextLength: document.directTextLength,
    ocrTextLength: updatedAiAnalysis.ocrTextLength,
    extractedTextLength: updatedText.length,
    extractionSource: updatedExtractionSource,
    aiAnalysis: updatedAiAnalysis,
  });

  await updateVehicleFinanceBankStatementIntelligenceJob(jobId, {
    status: "PROCESSED",
    completedAt: new Date().toISOString(),
    errorMessage: null,
    resultDocumentId: document.documentId,
  });

  console.log("[BANK_STATEMENT_INTELLIGENCE_PERSISTED]", {
    applicationId: job.applicationId,
    documentId: document.documentId,
    jobId,
    persistedPayload: intelligence,
  });

  return intelligence;
}

export async function queueVehicleFinanceBankStatementIntelligence(applicationId: string, documentId: string) {
  const job = await createVehicleFinanceBankStatementIntelligenceJob(applicationId, documentId);
  void processVehicleFinanceBankStatementIntelligenceJob(job.jobId);
  return job;
}

export async function getLatestVehicleFinanceBankStatementIntelligenceJobForDocument(documentId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_BANK_STATEMENT_INTELLIGENCE_JOB_COLLECTION)
    .where("documentId", "==", documentId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    jobId: doc.id,
    ...(doc.data() ?? {}),
  } as VehicleFinanceBankStatementIntelligenceJob;
}

export async function getVehicleFinanceBankStatementIntelligenceJobStatus(jobId: string) {
  return getVehicleFinanceBankStatementIntelligenceJob(jobId);
}
