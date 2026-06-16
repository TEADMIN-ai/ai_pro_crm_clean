import crypto from "node:crypto";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { buildVehicleFinanceDriverLicenceIntelligence } from "./driverLicenceIntelligence";
import type {
  VehicleFinanceApplication,
  VehicleFinanceCustomer,
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
  VehicleFinanceDriverLicenceIntelligenceJob,
} from "@/types/vehicleFinance";
import {
  VEHICLE_FINANCE_DRIVER_LICENCE_INTELLIGENCE_JOB_COLLECTION,
  VEHICLE_FINANCE_DOCUMENT_TYPES,
} from "@/types/vehicleFinance";

const APPLICATION_COLLECTION = "vehicleFinanceApplications";
const CUSTOMER_COLLECTION = "vehicleFinanceCustomers";
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

function normalizeApplicationData(id: string, data: Record<string, unknown>): VehicleFinanceApplication {
  return {
    applicationId: id,
    customerId: asString(data.customerId),
    vehicleId: asString(data.vehicleId),
    dealerName: asString(data.dealerName),
    dealValue: asNumber(data.dealValue),
    applicationStatus: (asString(data.applicationStatus) || "NEW") as VehicleFinanceApplication["applicationStatus"],
    fraudScore: asNumber(data.fraudScore),
    verificationStatus: (asString(data.verificationStatus) || "PENDING") as VehicleFinanceApplication["verificationStatus"],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
  };
}

function normalizeCustomerData(id: string, data: Record<string, unknown>): VehicleFinanceCustomer {
  return {
    customerId: id,
    firstName: asString(data.firstName),
    lastName: asString(data.lastName),
    idNumber: asString(data.idNumber),
    phone: asString(data.phone),
    email: asString(data.email),
    address: asString(data.address),
    employer: asString(data.employer),
    monthlyIncome: asNumber(data.monthlyIncome),
    createdAt: toIso(data.createdAt),
  };
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
  return getFirebaseAdmin().collection(VEHICLE_FINANCE_DRIVER_LICENCE_INTELLIGENCE_JOB_COLLECTION).doc(jobId);
}

async function getVehicleFinanceApplicationContext(applicationId: string): Promise<{
  application: VehicleFinanceApplication | null;
  customer: VehicleFinanceCustomer | null;
}> {
  const db = getFirebaseAdmin();
  const applicationSnapshot = await db.collection(APPLICATION_COLLECTION).doc(applicationId).get();

  if (!applicationSnapshot.exists) {
    return { application: null, customer: null };
  }

  const application = normalizeApplicationData(applicationId, (applicationSnapshot.data() ?? {}) as Record<string, unknown>);
  const customerId = application.customerId;
  const customerSnapshot = customerId ? await db.collection(CUSTOMER_COLLECTION).doc(customerId).get() : null;

  return {
    application,
    customer: customerSnapshot?.exists
      ? normalizeCustomerData(customerSnapshot.id, (customerSnapshot.data() ?? {}) as Record<string, unknown>)
      : null,
  };
}

export async function getVehicleFinanceDriverLicenceIntelligenceDocument(documentId: string): Promise<VehicleFinanceDocument | null> {
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

export async function createVehicleFinanceDriverLicenceIntelligenceJob(applicationId: string, documentId: string) {
  const jobId = `${documentId}-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const job: VehicleFinanceDriverLicenceIntelligenceJob = {
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

async function getVehicleFinanceDriverLicenceIntelligenceJob(jobId: string): Promise<VehicleFinanceDriverLicenceIntelligenceJob | null> {
  const snapshot = await getJobRef(jobId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    jobId: snapshot.id,
    ...(snapshot.data() ?? {}),
  } as VehicleFinanceDriverLicenceIntelligenceJob;
}

async function updateVehicleFinanceDriverLicenceIntelligenceJob(
  jobId: string,
  update: Partial<VehicleFinanceDriverLicenceIntelligenceJob>,
) {
  await getJobRef(jobId).set(
    {
      ...update,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function claimVehicleFinanceDriverLicenceIntelligenceJob(jobId: string) {
  const jobRef = getJobRef(jobId);
  const timestamp = new Date().toISOString();

  return getFirebaseAdmin().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) {
      return null;
    }

    const job = snapshot.data() as VehicleFinanceDriverLicenceIntelligenceJob;
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

export async function processVehicleFinanceDriverLicenceIntelligenceJob(jobId: string) {
  const claimedJob = await claimVehicleFinanceDriverLicenceIntelligenceJob(jobId);
  if (!claimedJob) {
    return null;
  }

  const job = await getVehicleFinanceDriverLicenceIntelligenceJob(jobId);
  if (!job) {
    return null;
  }

  console.log("[vehicle-finance] licence intelligence job started", {
    jobId,
    applicationId: job.applicationId,
    documentId: job.documentId,
  });

  const document = await getVehicleFinanceDriverLicenceIntelligenceDocument(job.documentId);
  if (!document) {
    const errorMessage = "Vehicle finance document not found";
    await updateVehicleFinanceDriverLicenceIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage,
    });
    console.log("[vehicle-finance] licence intelligence job failed", {
      jobId,
      applicationId: job.applicationId,
      documentId: job.documentId,
      error: errorMessage,
    });
    return null;
  }

  const storageBucket = getFirebaseStorageBucket();
  const file = storageBucket.file(document.filePath);
  const [applicationContext, fileBuffer] = await Promise.all([
    getVehicleFinanceApplicationContext(job.applicationId),
    file.download().then(([buffer]) => Buffer.from(buffer)),
  ]);

  const intelligence = await buildVehicleFinanceDriverLicenceIntelligence({
    application: applicationContext.application,
    customer: applicationContext.customer,
    documentType: document.documentType,
    extractedText: document.extractedText,
    directTextLength: document.directTextLength,
    ocrTextLength: document.ocrTextLength,
    pageCount: document.pageCount,
    extractionSource: document.extractionSource,
    fileBuffer,
    filename: document.fileName,
    documentIntegrityScore:
      typeof (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.documentIntegrityScore === "number"
        ? ((document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>).documentIntegrityScore as number)
        : 0,
  });

  if (!intelligence) {
    await updateVehicleFinanceDriverLicenceIntelligenceJob(jobId, {
      status: "FAILED",
      completedAt: new Date().toISOString(),
      errorMessage: "Vehicle finance licence intelligence was not generated",
    });
    return null;
  }

  const updatedText = intelligence.usedOcrFallback && intelligence.selectedText.trim()
    ? intelligence.selectedText.trim()
    : document.extractedText.trim();
  const updatedExtractionSource = intelligence.usedOcrFallback && intelligence.selectedText.trim()
    ? "OCR"
    : document.extractionSource;
  const existingAnalysis = (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>) ?? {};
  const updatedAiAnalysis: VehicleFinanceDocumentAnalysis = {
    documentType: document.documentType,
    extractedTextLength: updatedText.length,
    directTextLength: document.directTextLength,
    ocrTextLength: intelligence.usedOcrFallback ? updatedText.length : document.ocrTextLength,
    pageCount: document.pageCount,
    extractionSource: updatedExtractionSource,
    documentIntegrityScore: existingAnalysis.documentIntegrityScore ?? 0,
    fraudIndicators: existingAnalysis.fraudIndicators ?? [],
    integrityNotes: existingAnalysis.integrityNotes ?? [],
    textQualityAssessment: intelligence.textQuality,
    documentClassification: intelligence.classification,
    driverLicenceIntelligence: intelligence,
  };

  await updateVehicleFinanceDocumentIntelligence(document.documentId, {
    extractedText: updatedText,
    directTextLength: document.directTextLength,
    ocrTextLength: updatedAiAnalysis.ocrTextLength,
    extractedTextLength: updatedText.length,
    extractionSource: updatedExtractionSource,
    aiAnalysis: updatedAiAnalysis,
  });

  await updateVehicleFinanceDriverLicenceIntelligenceJob(jobId, {
    status: "PROCESSED",
    completedAt: new Date().toISOString(),
    errorMessage: null,
    resultDocumentId: document.documentId,
  });

  console.log("[INTELLIGENCE_PERSISTED]", {
    applicationId: job.applicationId,
    documentId: document.documentId,
    jobId,
    persistedPayload: intelligence,
  });

  return intelligence;
}

export async function queueVehicleFinanceDriverLicenceIntelligence(applicationId: string, documentId: string) {
  const job = await createVehicleFinanceDriverLicenceIntelligenceJob(applicationId, documentId);
  void processVehicleFinanceDriverLicenceIntelligenceJob(job.jobId);
  return job;
}

export async function getLatestVehicleFinanceDriverLicenceIntelligenceJobForDocument(documentId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_DRIVER_LICENCE_INTELLIGENCE_JOB_COLLECTION)
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
  } as VehicleFinanceDriverLicenceIntelligenceJob;
}

export async function getVehicleFinanceDriverLicenceIntelligenceJobStatus(jobId: string) {
  return getVehicleFinanceDriverLicenceIntelligenceJob(jobId);
}
