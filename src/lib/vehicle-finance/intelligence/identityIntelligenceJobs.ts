import crypto from "node:crypto";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { buildVehicleFinanceIdentityIntelligence } from "./identityIntelligence";
import type {
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
  VehicleFinanceIdentityIntelligenceJob,
} from "@/types/vehicleFinance";
import {
  VEHICLE_FINANCE_IDENTITY_INTELLIGENCE_JOB_COLLECTION,
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
  return getFirebaseAdmin().collection(VEHICLE_FINANCE_IDENTITY_INTELLIGENCE_JOB_COLLECTION).doc(jobId);
}

export async function getVehicleFinanceIdentityIntelligenceDocument(documentId: string): Promise<VehicleFinanceDocument | null> {
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

export async function createVehicleFinanceIdentityIntelligenceJob(applicationId: string, documentId: string) {
  const jobId = `${documentId}-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const job: VehicleFinanceIdentityIntelligenceJob = {
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

async function getVehicleFinanceIdentityIntelligenceJob(jobId: string): Promise<VehicleFinanceIdentityIntelligenceJob | null> {
  const snapshot = await getJobRef(jobId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    jobId: snapshot.id,
    ...(snapshot.data() ?? {}),
  } as VehicleFinanceIdentityIntelligenceJob;
}

async function updateVehicleFinanceIdentityIntelligenceJob(
  jobId: string,
  update: Partial<VehicleFinanceIdentityIntelligenceJob>,
) {
  await getJobRef(jobId).set(
    {
      ...update,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function claimVehicleFinanceIdentityIntelligenceJob(jobId: string) {
  const jobRef = getJobRef(jobId);
  const timestamp = new Date().toISOString();

  return getFirebaseAdmin().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) {
      return null;
    }

    const job = snapshot.data() as VehicleFinanceIdentityIntelligenceJob;
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

export async function processVehicleFinanceIdentityIntelligenceJob(jobId: string) {
  const claimedJob = await claimVehicleFinanceIdentityIntelligenceJob(jobId);
  if (!claimedJob) {
    return null;
  }

  const job = await getVehicleFinanceIdentityIntelligenceJob(jobId);
  if (!job) {
    return null;
  }

  console.log("[vehicle-finance] identity intelligence job started", {
    jobId,
    applicationId: job.applicationId,
    documentId: job.documentId,
  });

  const document = await getVehicleFinanceIdentityIntelligenceDocument(job.documentId);
  if (!document) {
    const errorMessage = "Vehicle finance document not found";
    await updateVehicleFinanceIdentityIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage,
    });
    console.log("[vehicle-finance] identity intelligence job failed", {
      jobId,
      applicationId: job.applicationId,
      documentId: job.documentId,
      error: errorMessage,
    });
    return null;
  }

  const storageBucket = getFirebaseStorageBucket();
  const file = storageBucket.file(document.filePath);
  const extractedText = document.extractedText.trim();
  const [fileBuffer] = await file.download();
  const intelligence = await buildVehicleFinanceIdentityIntelligence({
    documentType: document.documentType,
    extractedText,
    fileBuffer: Buffer.from(fileBuffer),
    filename: document.fileName,
    pageCount: document.pageCount,
    documentIntegrityScore:
      typeof (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.documentIntegrityScore === "number"
        ? ((document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>).documentIntegrityScore as number)
        : 0,
  });

  if (!intelligence) {
    await updateVehicleFinanceIdentityIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage: "Vehicle finance identity intelligence was not generated",
    });
    return null;
  }

  const updatedAiAnalysis: VehicleFinanceDocumentAnalysis = {
    documentType: document.documentType,
    extractedTextLength: extractedText.length,
    directTextLength: document.directTextLength,
    ocrTextLength: document.ocrTextLength,
    pageCount: document.pageCount,
    extractionSource: document.extractionSource,
    documentIntegrityScore:
      typeof (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.documentIntegrityScore === "number"
        ? ((document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>).documentIntegrityScore as number)
        : 0,
    fraudIndicators: (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.fraudIndicators ?? [],
    integrityNotes: (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.integrityNotes ?? [],
    textQualityAssessment: (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.textQualityAssessment ?? null,
    documentClassification: intelligence.classification,
    identityIntelligence: intelligence,
  };

  await updateVehicleFinanceDocumentIntelligence(document.documentId, {
    extractedText,
    directTextLength: document.directTextLength,
    ocrTextLength: document.ocrTextLength,
    extractedTextLength: extractedText.length,
    extractionSource: document.extractionSource,
    aiAnalysis: updatedAiAnalysis,
  });

  await updateVehicleFinanceIdentityIntelligenceJob(jobId, {
    status: "PROCESSED",
    completedAt: new Date().toISOString(),
    errorMessage: null,
    resultDocumentId: document.documentId,
  });

  console.log("[IDENTITY_INTELLIGENCE_PERSISTED]", {
    applicationId: job.applicationId,
    documentId: document.documentId,
    jobId,
    persistedPayload: intelligence,
  });

  return intelligence;
}

export async function queueVehicleFinanceIdentityIntelligence(applicationId: string, documentId: string) {
  const job = await createVehicleFinanceIdentityIntelligenceJob(applicationId, documentId);
  void processVehicleFinanceIdentityIntelligenceJob(job.jobId);
  return job;
}

export async function getLatestVehicleFinanceIdentityIntelligenceJobForDocument(documentId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_IDENTITY_INTELLIGENCE_JOB_COLLECTION)
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
  } as VehicleFinanceIdentityIntelligenceJob;
}

export async function getVehicleFinanceIdentityIntelligenceJobStatus(jobId: string) {
  return getVehicleFinanceIdentityIntelligenceJob(jobId);
}
