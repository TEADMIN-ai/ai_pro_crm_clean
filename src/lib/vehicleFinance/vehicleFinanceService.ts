import crypto from "node:crypto";
import { jsPDF } from "jspdf";

import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { getVehicleFinanceFeatureFlags } from "@/lib/vehicle-finance/config/featureFlags";
import { queueVehicleFinanceDriverLicenceIntelligence } from "@/lib/vehicle-finance/intelligence/driverLicenceIntelligenceJobs";
import { queueVehicleFinanceIdentityIntelligence } from "@/lib/vehicle-finance/intelligence/identityIntelligenceJobs";
import { queueVehicleFinancePayslipIntelligence } from "@/lib/vehicle-finance/intelligence/payslipIntelligenceJobs";
import { queueVehicleFinanceBankStatementIntelligence } from "@/lib/vehicle-finance/intelligence/bankStatementIntelligenceJobs";
import { buildVehicleFinanceWorkflowEvent, buildVehicleFinanceWorkflowSnapshot, buildVehicleFinanceWorkflowTask, type VehicleFinanceWorkflowSnapshot } from "@/lib/vehicle-finance/workflow";

import type {
  VehicleFinanceApplication,
  VehicleFinanceAssessment,
  VehicleFinanceCertificate,
  VehicleFinanceCustomer,
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
  VehicleFinanceDocumentType,
  VehicleFinanceRiskLevel,
} from "@/types/vehicleFinance";
import { normalizeVehicleFinanceDocumentType, resolveVehicleFinanceRiskLevel, VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES } from "@/types/vehicleFinance";

export { normalizeVehicleFinanceDocumentType };

const CUSTOMER_COLLECTION = "vehicleFinanceCustomers";
const APPLICATION_COLLECTION = "vehicleFinanceApplications";
const DOCUMENT_COLLECTION = "vehicleFinanceDocuments";
const ASSESSMENT_COLLECTION = "vehicleFinanceAssessments";
const CERTIFICATE_COLLECTION = "vehicleFinanceCertificates";
const APPLICATION_EVENT_COLLECTION = "vehicleFinanceApplicationEvents";
const WORKFLOW_TASK_COLLECTION = "vehicleFinanceWorkflowTasks";
const WORKFLOW_TIMELINE_COLLECTION = "vehicleFinanceWorkflowTimeline";



type ActorContext = {
  actorId?: string;
  actorRole?: string;
  actorName?: string;
};

type VehicleFinanceOperation =
  | "Application Created"
  | "Application Updated"
  | "Application Create Failed"
  | "Email Sent"
  | "Email Failed"
  | "Storage Uploaded"
  | "Storage Upload Failed"
  | "Storage Deleted"
  | "Cleanup Executed"
  | "Audit Created"
  | "Audit Failed"
  | "Metric Created"
  | "Metric Failed"
  | "Decision Log Created"
  | "Decision Log Failed"
  | "Document Record Created"
  | "Document Record Failed";

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

function scoreClamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function keywordMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractSalaryAmounts(text: string): number[] {
  const matches = text.match(/r\s?\d[\d,]*(?:\.\d{2})?/gi) ?? [];
  return matches.map(parseAmount).filter((amount): amount is number => typeof amount === "number");
}

function getDisplayName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
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
    operatingDivision: asString(data.operatingDivision) || null,
  };
}

function normalizeApplicationData(id: string, data: Record<string, unknown>): VehicleFinanceApplication {
  return {
    applicationId: id,
    customerId: asString(data.customerId),
    vehicleId: asString(data.vehicleId),
    clientSubmissionId: asString(data.clientSubmissionId) || null,
    vehicleInventoryId: asString(data.vehicleInventoryId) || null,
    vehicleTitle: asString(data.vehicleTitle) || null,
    vehiclePrice: asNumber(data.vehiclePrice, 0) || null,
    vehicleYear: asNumber(data.vehicleYear, 0) || null,
    vehicleMileage: asNumber(data.vehicleMileage, 0) || null,
    vehicleImageUrl: asString(data.vehicleImageUrl) || null,
    vehicleListingUrl: asString(data.vehicleListingUrl) || null,
    inventorySource: asString(data.inventorySource) || null,
    dealerName: asString(data.dealerName),
    dealValue: asNumber(data.dealValue),
    applicationStatus: (asString(data.applicationStatus) || "NEW") as VehicleFinanceApplication["applicationStatus"],
    fraudScore: scoreClamp(asNumber(data.fraudScore)),
    verificationStatus: (asString(data.verificationStatus) || "PENDING") as VehicleFinanceApplication["verificationStatus"],
    isDeleted: data.isDeleted === true,
    archived: data.archived === true,
    inactive: data.inactive === true,
    createdByUid: asString(data.createdByUid) || null,
    createdVia: (asString(data.createdVia) || "web") as VehicleFinanceApplication["createdVia"],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
    operatingDivision: asString(data.operatingDivision) || null,
    workflowSnapshot: (data.workflowSnapshot as VehicleFinanceWorkflowSnapshot | null) ?? null,
  };
}

function normalizeDocumentData(id: string, data: Record<string, unknown>): VehicleFinanceDocument {
  return {
    documentId: id,
    applicationId: asString(data.applicationId),
    documentType: asString(data.documentType) as VehicleFinanceDocumentType,
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

function normalizeAssessmentData(data: Record<string, unknown>): VehicleFinanceAssessment {
  return {
    applicationId: asString(data.applicationId),
    identityScore: scoreClamp(asNumber(data.identityScore)),
    incomeScore: scoreClamp(asNumber(data.incomeScore)),
    bankScore: scoreClamp(asNumber(data.bankScore)),
    documentIntegrityScore: scoreClamp(asNumber(data.documentIntegrityScore)),
    overallFraudScore: scoreClamp(asNumber(data.overallFraudScore)),
    riskLevel: resolveVehicleFinanceRiskLevel(asNumber(data.overallFraudScore)) as VehicleFinanceRiskLevel,
    verificationStatus: (asString(data.verificationStatus) || "PENDING") as VehicleFinanceAssessment["verificationStatus"],
    riskReasons: Array.isArray(data.riskReasons) ? data.riskReasons.filter((item): item is string => typeof item === "string") : [],
    updatedAt: toIso(data.updatedAt),
  };
}

function normalizeCertificateData(id: string, data: Record<string, unknown>): VehicleFinanceCertificate {
  return {
    certificateId: id,
    applicationId: asString(data.applicationId),
    certificateUrl: asString(data.certificateUrl),
    certificatePath: asString(data.certificatePath),
    verificationDate: toIso(data.verificationDate ?? data.createdAt),
    verifiedBy: asString(data.verifiedBy),
    createdAt: toIso(data.createdAt),
  };
}

async function recordAuditEvent(args: {
  eventType: string;
  actor: ActorContext;
  applicationId?: string;
  customerId?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await getFirebaseAdmin().collection("auditLogs").add({
    eventType: args.eventType,
    actorId: args.actor.actorId ?? null,
    actorRole: args.actor.actorRole ?? null,
    actorName: args.actor.actorName ?? null,
    contractorId: null,
    customerId: args.customerId ?? null,
    applicationId: args.applicationId ?? null,
    targetId: args.targetId ?? null,
    previousValue: args.previousValue ?? null,
    newValue: args.newValue ?? null,
    timestamp: new Date(),
    metadata: args.metadata ?? {},
  });
}

function serializeVehicleFinanceError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }
  return {
    message: String(error),
    name: "UnknownError",
    stack: null,
  };
}

async function recordVehicleFinanceOperation(args: {
  operation: VehicleFinanceOperation;
  applicationId?: string | null;
  userId?: string | null;
  actor?: ActorContext;
  targetId?: string | null;
  status: "success" | "failure" | "warning";
  exception?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const timestamp = new Date().toISOString();
  const payload = {
    operation: args.operation,
    applicationId: args.applicationId ?? null,
    userId: args.userId ?? args.actor?.actorId ?? null,
    actorRole: args.actor?.actorRole ?? null,
    actorName: args.actor?.actorName ?? null,
    targetId: args.targetId ?? null,
    status: args.status,
    timestamp,
    exception: args.exception ? serializeVehicleFinanceError(args.exception) : null,
    metadata: args.metadata ?? {},
  };

  try {
    await getFirebaseAdmin().collection(APPLICATION_EVENT_COLLECTION).add(payload);
  } catch (logError) {
    const serialized = serializeVehicleFinanceError(logError);
    console.error("[vehicle-finance] operation log failed", {
      ...payload,
      loggingException: serialized,
    });
  }
}

async function safeRecordAuditEvent(args: Parameters<typeof recordAuditEvent>[0]) {
  try {
    await recordAuditEvent(args);
    await recordVehicleFinanceOperation({
      operation: "Audit Created",
      applicationId: args.applicationId,
      actor: args.actor,
      targetId: args.targetId,
      status: "success",
      metadata: { eventType: args.eventType },
    });
  } catch (error) {
    console.error("[vehicle-finance] audit event failed", {
      applicationId: args.applicationId ?? null,
      userId: args.actor.actorId ?? null,
      operation: "Audit Created",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Audit Failed",
      applicationId: args.applicationId,
      actor: args.actor,
      targetId: args.targetId,
      status: "failure",
      exception: error,
      metadata: { eventType: args.eventType },
    });
  }
}

async function recordDecisionLog(args: {
  applicationId: string;
  previousFraudScore: number | null;
  newFraudScore: number;
  triggerEvent: string;
  reasonForChange: string;
  metadata?: Record<string, unknown>;
}) {
  await getFirebaseAdmin().collection("decisionLogs").add({
    contractorId: null,
    applicationId: args.applicationId,
    previousReadinessScore: args.previousFraudScore,
    newReadinessScore: args.newFraudScore,
    triggerEvent: args.triggerEvent,
    reasonForChange: args.reasonForChange,
    timestamp: new Date(),
    metadata: args.metadata ?? {},
  });
}

async function safeRecordDecisionLog(args: Parameters<typeof recordDecisionLog>[0]) {
  try {
    await recordDecisionLog(args);
    await recordVehicleFinanceOperation({
      operation: "Decision Log Created",
      applicationId: args.applicationId,
      status: "success",
      metadata: { triggerEvent: args.triggerEvent },
    });
  } catch (error) {
    console.error("[vehicle-finance] decision log failed", {
      applicationId: args.applicationId,
      operation: "Decision Log Created",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Decision Log Failed",
      applicationId: args.applicationId,
      status: "failure",
      exception: error,
      metadata: { triggerEvent: args.triggerEvent },
    });
  }
}

async function recordSystemMetric(args: {
  metricType: string;
  route: string;
  durationMs?: number;
  applicationId?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await getFirebaseAdmin().collection("systemMetrics").add({
    metricType: args.metricType,
    route: args.route,
    durationMs: args.durationMs ?? null,
    applicationId: args.applicationId ?? null,
    targetId: args.targetId ?? null,
    timestamp: new Date(),
    metadata: args.metadata ?? {},
  });
}

async function safeRecordSystemMetric(args: Parameters<typeof recordSystemMetric>[0]) {
  try {
    await recordSystemMetric(args);
    await recordVehicleFinanceOperation({
      operation: "Metric Created",
      applicationId: args.applicationId,
      targetId: args.targetId,
      status: "success",
      metadata: { metricType: args.metricType, route: args.route },
    });
  } catch (error) {
    console.error("[vehicle-finance] system metric failed", {
      applicationId: args.applicationId ?? null,
      targetId: args.targetId ?? null,
      operation: "Metric Created",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Metric Failed",
      applicationId: args.applicationId,
      targetId: args.targetId,
      status: "failure",
      exception: error,
      metadata: { metricType: args.metricType, route: args.route },
    });
  }
}

async function writeWithRetry(operation: () => Promise<unknown>, args: {
  operationName: string;
  applicationId?: string | null;
  userId?: string | null;
  attempts?: number;
}) {
  const attempts = args.attempts ?? 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await operation();
      if (attempt > 1) {
        console.info("[vehicle-finance] write retry succeeded", {
          applicationId: args.applicationId ?? null,
          userId: args.userId ?? null,
          operation: args.operationName,
          attempt,
        });
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn("[vehicle-finance] write attempt failed", {
        applicationId: args.applicationId ?? null,
        userId: args.userId ?? null,
        operation: args.operationName,
        attempt,
        exception: serializeVehicleFinanceError(error),
      });
    }
  }

  throw lastError;
}

function assessTextConsistency(args: {
  customer: VehicleFinanceCustomer;
  documents: VehicleFinanceDocument[];
}): {
  identityScore: number;
  incomeScore: number;
  bankScore: number;
  documentIntegrityScore: number;
  riskReasons: string[];
} {
  const customerName = getDisplayName(args.customer.firstName, args.customer.lastName).toLowerCase();
  const idDigits = args.customer.idNumber.replace(/\D/g, "");
  const idDocs = args.documents.filter((document) => document.documentType === "saIdDocument");
  const licenseDocs = args.documents.filter((document) => document.documentType === "driversLicense");
  const payslips = args.documents.filter((document) => document.documentType === "payslip");
  const bankStatements = args.documents.filter((document) => document.documentType === "bankStatement");
  const employmentLetters = args.documents.filter((document) => document.documentType === "employmentLetter");

  const identitySignals: number[] = [];
  const riskReasons: string[] = [];

  identitySignals.push(idDigits.length === 13 ? 100 : 20);

  const nameEvidence = [...idDocs, ...licenseDocs]
    .filter((document) => document.extractedText.toLowerCase().includes(customerName))
    .length;
  identitySignals.push(nameEvidence > 0 ? 100 : 45);

  if (idDocs.length === 0) riskReasons.push("ID document missing");
  if (licenseDocs.length === 0) riskReasons.push("Driver's license missing");

  const incomeAmounts = [...payslips, ...employmentLetters]
    .flatMap((document) => extractSalaryAmounts(document.extractedText));
  const incomeBaseline = incomeAmounts.length > 0 ? average(incomeAmounts) : args.customer.monthlyIncome;
  const incomeSignals: number[] = [
    incomeBaseline > 0 ? 100 : 20,
    payslips.length > 0 ? 100 : 0,
    employmentLetters.length > 0 ? 100 : 0,
  ];

  if (payslips.length === 0) riskReasons.push("Payslip missing");
  if (employmentLetters.length === 0) riskReasons.push("Employment letter missing");

  const bankSignals: number[] = [
    bankStatements.length > 0 ? 100 : 0,
    bankStatements.some((document) => document.extractedText.toLowerCase().includes(customerName)) ? 100 : 40,
    bankStatements.some((document) => /salary|payroll|deposit/i.test(document.extractedText)) ? 100 : 35,
  ];

  if (bankStatements.length === 0) riskReasons.push("Bank statement missing");

  const integritySignals = args.documents.map((document) => {
    const analysis = document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>;
    return scoreClamp(
      (analysis.documentIntegrityScore ?? 0) ||
        Math.max(
          0,
          100 -
            (document.extractionSource === "EMPTY" ? 70 : 0) -
            (document.extractedTextLength < 40 ? 20 : 0) -
            (document.pageCount < 1 ? 40 : 0)
        )
    );
  });

  if (args.documents.some((document) => document.extractionSource === "EMPTY")) {
    riskReasons.push("One or more documents could not be extracted");
  }

  const identityScore = scoreClamp(average(identitySignals));
  const incomeScore = scoreClamp(average(incomeSignals));
  const bankScore = scoreClamp(average(bankSignals));
  const documentIntegrityScore = scoreClamp(average(integritySignals));

  return { identityScore, incomeScore, bankScore, documentIntegrityScore, riskReasons };
}

function calculateFraudScore(scores: {
  identityScore: number;
  incomeScore: number;
  bankScore: number;
  documentIntegrityScore: number;
}): number {
  const quality = average([
    scores.identityScore * 0.3,
    scores.incomeScore * 0.25,
    scores.bankScore * 0.25,
    scores.documentIntegrityScore * 0.2,
  ]);

  return scoreClamp(100 - quality);
}

function buildDocumentAnalysis(args: {
  documentType: VehicleFinanceDocumentType;
  extractedText: string;
  directTextLength: number;
  ocrTextLength: number;
  pageCount: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY";
}): VehicleFinanceDocumentAnalysis {
  const fraudIndicators = keywordMatches(args.extractedText, [
    "edited",
    "cropped",
    "tampered",
    "forged",
    "duplicate",
    "sample",
    "specimen",
    "copy",
    "invalid",
  ]);

  const integrityNotes: string[] = [];
  let score = 100;

  if (args.extractionSource === "EMPTY") {
    score = 0;
    integrityNotes.push("No usable text extracted");
  } else {
    if (args.extractionSource === "OCR" && args.directTextLength === 0) {
      score -= 10;
      integrityNotes.push("OCR-only extraction required");
    }
    if (args.pageCount <= 0) {
      score -= 40;
      integrityNotes.push("Missing page count");
    }
    if (args.extractedText.length < 60) {
      score -= 20;
      integrityNotes.push("Low text volume");
    }
    if (fraudIndicators.length > 0) {
      score -= 20;
      integrityNotes.push(`Manipulation keywords detected: ${fraudIndicators.join(", ")}`);
    }
  }

  return {
    documentType: args.documentType,
    extractedTextLength: args.extractedText.length,
    directTextLength: args.directTextLength,
    ocrTextLength: args.ocrTextLength,
    pageCount: args.pageCount,
    extractionSource: args.extractionSource,
    documentIntegrityScore: scoreClamp(score),
    fraudIndicators,
    integrityNotes,
  };
}

async function saveVehicleFinanceDocument(args: {
  applicationId: string;
  documentType: VehicleFinanceDocumentType;
  fileName: string;
  fileBuffer: Buffer;
  extractedText: string;
  directTextLength: number;
  ocrTextLength: number;
  pageCount: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY";
  aiAnalysis: VehicleFinanceDocumentAnalysis;
}) {
  const documentId = crypto.randomUUID();
  const storagePath = `vehicle-finance/${args.applicationId}/${documentId}_${args.documentType}.pdf`;
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(storagePath);
  try {
    await file.save(args.fileBuffer, {
      contentType: "application/pdf",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0, no-transform",
      },
    });
    await recordVehicleFinanceOperation({
      operation: "Storage Uploaded",
      applicationId: args.applicationId,
      targetId: documentId,
      status: "success",
      metadata: { storagePath, documentType: args.documentType },
    });
  } catch (error) {
    console.error("[vehicle-finance] storage upload failed", {
      applicationId: args.applicationId,
      targetId: documentId,
      operation: "Storage Uploaded",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Storage Upload Failed",
      applicationId: args.applicationId,
      targetId: documentId,
      status: "failure",
      exception: error,
      metadata: { storagePath, documentType: args.documentType },
    });
    throw error;
  }

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  const now = new Date().toISOString();
  const record: VehicleFinanceDocument = {
    documentId,
    applicationId: args.applicationId,
    documentType: args.documentType,
    filePath: storagePath,
    fileName: args.fileName,
    extractedText: args.extractedText,
    aiAnalysis: args.aiAnalysis,
    uploadedAt: now,
    directTextLength: args.directTextLength,
    ocrTextLength: args.ocrTextLength,
    extractedTextLength: args.extractedText.length,
    pageCount: args.pageCount,
    extractionSource: args.extractionSource,
  };

  try {
    await getFirebaseAdmin()
      .collection(DOCUMENT_COLLECTION)
      .doc(documentId)
      .set({
        ...record,
        certificateUrl: signedUrl,
      });
    await recordVehicleFinanceOperation({
      operation: "Document Record Created",
      applicationId: args.applicationId,
      targetId: documentId,
      status: "success",
      metadata: { storagePath, documentType: args.documentType },
    });
  } catch (error) {
    console.error("[vehicle-finance] document record write failed", {
      applicationId: args.applicationId,
      targetId: documentId,
      operation: "Document Record Created",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Document Record Failed",
      applicationId: args.applicationId,
      targetId: documentId,
      status: "failure",
      exception: error,
      metadata: { storagePath, documentType: args.documentType },
    });
    throw error;
  }

  return { record, signedUrl, storagePath };
}

async function recalculateApplicationAssessment(applicationId: string, actor?: ActorContext) {
  const db = getFirebaseAdmin();
  const [applicationSnapshot, customerSnapshot, documentSnapshot, assessmentSnapshot] = await Promise.all([
    db.collection(APPLICATION_COLLECTION).doc(applicationId).get(),
    db.collection(APPLICATION_COLLECTION).doc(applicationId).get().then(async (appSnap) => {
      const appData = (appSnap.data() ?? {}) as Record<string, unknown>;
      const customerId = asString(appData.customerId);
      return customerId ? db.collection(CUSTOMER_COLLECTION).doc(customerId).get() : null;
    }),
    db.collection(DOCUMENT_COLLECTION).where("applicationId", "==", applicationId).get(),
    db.collection(ASSESSMENT_COLLECTION).doc(applicationId).get(),
  ]);

  if (!applicationSnapshot.exists) {
    throw new Error("Vehicle finance application not found");
  }

  const applicationData = normalizeApplicationData(applicationId, (applicationSnapshot.data() ?? {}) as Record<string, unknown>);
  const customerData = customerSnapshot?.exists
    ? normalizeCustomerData(customerSnapshot.id, (customerSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;

  if (!customerData) {
    throw new Error("Vehicle finance customer not found");
  }

  const documents = documentSnapshot.docs.map((doc) => normalizeDocumentData(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  const previousAssessment = assessmentSnapshot.exists ? normalizeAssessmentData((assessmentSnapshot.data() ?? {}) as Record<string, unknown>) : null;
  const scores = assessTextConsistency({ customer: customerData, documents });
  const overallFraudScore = calculateFraudScore(scores);
  const riskLevel = resolveVehicleFinanceRiskLevel(overallFraudScore);
  const verificationStatus =
    riskLevel === "LOW" ? "VERIFIED" : riskLevel === "MEDIUM" ? "REVIEW" : "FLAGGED";
  const applicationStatus =
    verificationStatus === "VERIFIED" ? "VERIFIED" : verificationStatus === "REVIEW" ? "IN_REVIEW" : "FLAGGED";

  const assessment: VehicleFinanceAssessment = {
    applicationId,
    identityScore: scores.identityScore,
    incomeScore: scores.incomeScore,
    bankScore: scores.bankScore,
    documentIntegrityScore: scores.documentIntegrityScore,
    overallFraudScore,
    riskLevel,
    verificationStatus,
    riskReasons: scores.riskReasons,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(ASSESSMENT_COLLECTION).doc(applicationId).set(assessment);
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).set(
    {
      ...applicationData,
      fraudScore: overallFraudScore,
      verificationStatus,
      applicationStatus,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await safeRecordDecisionLog({
    applicationId,
    previousFraudScore: previousAssessment?.overallFraudScore ?? null,
    newFraudScore: overallFraudScore,
    triggerEvent: "VEHICLE_FINANCE_REASSESSMENT",
    reasonForChange: scores.riskReasons.length ? scores.riskReasons.join("; ") : "Application re-evaluated after document upload",
    metadata: {
      identityScore: scores.identityScore,
      incomeScore: scores.incomeScore,
      bankScore: scores.bankScore,
      documentIntegrityScore: scores.documentIntegrityScore,
    },
  });

  await safeRecordAuditEvent({
    eventType: "VEHICLE_FINANCE_APPLICATION_REASSESSED",
    actor: actor ?? {},
    applicationId,
    customerId: customerData.customerId,
    targetId: applicationId,
    previousValue: previousAssessment?.overallFraudScore ?? null,
    newValue: overallFraudScore,
    metadata: assessment,
  });

  return { application: applicationData, assessment, documents, customer: customerData };
}

export async function createVehicleFinanceCustomer(input: {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  employer: string;
  monthlyIncome: number;
}, actor: ActorContext) {
  const customerId = crypto.randomUUID();
  const record: VehicleFinanceCustomer = {
    customerId,
    firstName: input.firstName,
    lastName: input.lastName,
    idNumber: input.idNumber,
    phone: input.phone,
    email: input.email,
    address: input.address,
    employer: input.employer,
    monthlyIncome: input.monthlyIncome,
    createdAt: new Date().toISOString(),
    operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION,
  };

  await getFirebaseAdmin().collection(CUSTOMER_COLLECTION).doc(customerId).set(record);
  await safeRecordAuditEvent({
    eventType: "VEHICLE_FINANCE_CUSTOMER_CREATED",
    actor,
    customerId,
    targetId: customerId,
    newValue: record,
    metadata: { module: "vehicle-finance" },
  });

  return record;
}

export async function listVehicleFinanceCustomers(): Promise<VehicleFinanceCustomer[]> {
  const snapshot = await getFirebaseAdmin().collection(CUSTOMER_COLLECTION).limit(200).get();
  return snapshot.docs
    .map((doc) => normalizeCustomerData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createVehicleFinanceApplication(input: {
  customerId: string;
  vehicleId: string;
  clientSubmissionId?: string | null;
  dealerName: string;
  dealValue: number;
  vehicleInventoryId?: string;
  vehicleTitle?: string | null;
  vehiclePrice?: number | null;
  vehicleYear?: number | null;
  vehicleMileage?: number | null;
  vehicleImageUrl?: string | null;
  vehicleListingUrl?: string | null;
  inventorySource?: string | null;
}, actor: ActorContext) {
  const clientSubmissionId = asString(input.clientSubmissionId);
  if (clientSubmissionId) {
    const existingSnapshot = await getFirebaseAdmin()
      .collection(APPLICATION_COLLECTION)
      .where("clientSubmissionId", "==", clientSubmissionId)
      .limit(1)
      .get();
    const existing = existingSnapshot.docs[0];
    if (existing) {
      return normalizeApplicationData(existing.id, (existing.data() ?? {}) as Record<string, unknown>);
    }
  }

  const applicationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: VehicleFinanceApplication = {
    applicationId,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    clientSubmissionId: clientSubmissionId || null,
    vehicleInventoryId: input.vehicleInventoryId ?? null,
    vehicleTitle: input.vehicleTitle ?? null,
    vehiclePrice: input.vehiclePrice ?? null,
    vehicleYear: input.vehicleYear ?? null,
    vehicleMileage: input.vehicleMileage ?? null,
    vehicleImageUrl: input.vehicleImageUrl ?? null,
    vehicleListingUrl: input.vehicleListingUrl ?? null,
    inventorySource: input.inventorySource ?? null,
    dealerName: input.dealerName,
    dealValue: input.dealValue,
    applicationStatus: "NEW",
    fraudScore: 100,
    verificationStatus: "PENDING",
    isDeleted: false,
    archived: false,
    inactive: false,
    createdByUid: actor.actorId ?? null,
    createdVia: "web",
    createdAt: now,
    updatedAt: now,
    operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION,
  };

  record.workflowSnapshot = buildVehicleFinanceWorkflowSnapshot({ application: record, customer: null, documents: [], assessment: null, certificate: null, actor, now: new Date() });
  try {
    await writeWithRetry(
      () => getFirebaseAdmin().collection(APPLICATION_COLLECTION).doc(applicationId).set(record),
      {
        operationName: "Application Created",
        applicationId,
        userId: actor.actorId ?? null,
      },
    );
    await recordVehicleFinanceOperation({
      operation: "Application Created",
      applicationId,
      actor,
      status: "success",
      metadata: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        clientSubmissionId: record.clientSubmissionId,
      },
    });
  } catch (error) {
    console.error("[vehicle-finance] primary application write failed", {
      applicationId,
      userId: actor.actorId ?? null,
      operation: "Application Created",
      exception: serializeVehicleFinanceError(error),
    });
    await recordVehicleFinanceOperation({
      operation: "Application Create Failed",
      applicationId,
      actor,
      status: "failure",
      exception: error,
      metadata: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        clientSubmissionId: record.clientSubmissionId,
      },
    });
    throw error;
  }

  await safeRecordAuditEvent({
    eventType: "VEHICLE_FINANCE_APPLICATION_CREATED",
    actor,
    customerId: input.customerId,
    applicationId,
    targetId: applicationId,
    newValue: record,
    metadata: { module: "vehicle-finance" },
  });

  const workflowContext = {
    application: record,
    customer: null,
    documents: [],
    assessment: null,
    certificate: null,
    actor,
    now: new Date(),
  };
  const workflowSnapshot = buildVehicleFinanceWorkflowSnapshot(workflowContext);
  const workflowTask = buildVehicleFinanceWorkflowTask(workflowSnapshot, workflowContext);
  const workflowEvent = buildVehicleFinanceWorkflowEvent(workflowSnapshot, workflowContext, 'Workflow created', 'Initial workflow created from website submission', 'workflow.created', []);
  record.workflowSnapshot = workflowSnapshot;

  await getFirebaseAdmin().collection(WORKFLOW_TASK_COLLECTION).add(workflowTask);
  await getFirebaseAdmin().collection(WORKFLOW_TIMELINE_COLLECTION).add(workflowEvent);
  return record;
}
export async function listVehicleFinanceApplications(): Promise<VehicleFinanceApplication[]> {
  const snapshot = await getFirebaseAdmin().collection(APPLICATION_COLLECTION).limit(200).get();
  return snapshot.docs
    .map((doc) => normalizeApplicationData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getVehicleFinanceApplication(applicationId: string) {
  const db = getFirebaseAdmin();
  const applicationRef = db.collection(APPLICATION_COLLECTION).doc(applicationId);
  const assessmentRef = db.collection(ASSESSMENT_COLLECTION).doc(applicationId);

  const applicationSnapshot = await applicationRef.get();
  const applicationExists = applicationSnapshot.exists;

  console.log("[vehicle-finance] application lookup", {
    applicationId,
    applicationExists,
  });

  if (!applicationExists) {
    throw new Error("Vehicle finance application not found");
  }

  const application = normalizeApplicationData(applicationId, (applicationSnapshot.data() ?? {}) as Record<string, unknown>);
  const customerId = application.customerId.trim();

  const [customerSnapshot, assessmentSnapshot, documentSnapshot] = await Promise.all([
    customerId ? db.collection(CUSTOMER_COLLECTION).doc(customerId).get() : Promise.resolve(null),
    assessmentRef.get(),
    db.collection(DOCUMENT_COLLECTION).where("applicationId", "==", applicationId).get(),
  ]);

  const customerExists = Boolean(customerSnapshot?.exists);
  const assessmentExists = assessmentSnapshot.exists;
  const documentExists = documentSnapshot.size > 0;

  console.log("[vehicle-finance] application resolution", {
    applicationId,
    documentExists,
    customerExists,
    assessmentExists,
  });

  const customer = customerSnapshot?.exists
    ? normalizeCustomerData(customerSnapshot.id, (customerSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;
  const assessment = assessmentSnapshot.exists
    ? normalizeAssessmentData((assessmentSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;
  const documents = documentSnapshot.docs
    .map((doc) => normalizeDocumentData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

  return {
    application,
    customer,
    assessment,
    documents,
    flags: {
      applicationExists,
      documentExists,
      customerExists,
      assessmentExists,
    },
  };
}

export async function listVehicleFinanceDocuments(applicationId?: string): Promise<VehicleFinanceDocument[]> {
  const query = applicationId
    ? getFirebaseAdmin().collection(DOCUMENT_COLLECTION).where("applicationId", "==", applicationId)
    : getFirebaseAdmin().collection(DOCUMENT_COLLECTION);

  const snapshot = await query.limit(500).get();
  return snapshot.docs
    .map((doc) => normalizeDocumentData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export async function listVehicleFinanceAssessments(): Promise<VehicleFinanceAssessment[]> {
  const snapshot = await getFirebaseAdmin().collection(ASSESSMENT_COLLECTION).limit(200).get();
  return snapshot.docs
    .map((doc) => normalizeAssessmentData((doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listVehicleFinanceCertificates(): Promise<VehicleFinanceCertificate[]> {
  const snapshot = await getFirebaseAdmin().collection(CERTIFICATE_COLLECTION).limit(200).get();
  return snapshot.docs
    .map((doc) => normalizeCertificateData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getVehicleFinanceOverview() {
  const [customers, applications, documents, assessments, certificates, businessClients, suppliers, procurementCases, supplierQuotes] = await Promise.all([
    listVehicleFinanceCustomers(),
    listVehicleFinanceApplications(),
    listVehicleFinanceDocuments(),
    listVehicleFinanceAssessments(),
    listVehicleFinanceCertificates(),
    listVehicleFinanceBusinessClients(),
    listVehicleFinanceSuppliers(),
    listVehicleFinanceProcurementCases(),
    listVehicleFinanceSupplierQuotes(),
  ]);

  const verifiedApplications = applications.filter((application) => application.verificationStatus === "VERIFIED").length;
  const pendingVerification = applications.filter((application) => application.verificationStatus === "PENDING" || application.verificationStatus === "REVIEW").length;
  const fraudAlerts = applications.filter((application) => application.fraudScore >= 51).length;
  const approvalRatio = applications.length > 0 ? Math.round((verifiedApplications / applications.length) * 100) : 0;
  const monthlyDealValue = applications.reduce((sum, application) => sum + (application.dealValue || 0), 0);

  return {
    metrics: {
      totalApplications: applications.length,
      pendingVerification,
      verifiedApplications,
      fraudAlerts,
      approvalRatio,
      monthlyDealValue,
    },
    customers,
    applications,
    documents,
    assessments,
    certificates,
    businessClients,
    suppliers,
    procurementCases,
    supplierQuotes,
    procurementSummary: {
      activeBusinessClients: businessClients.filter((client) => client.accountStatus === "ACTIVE").length,
      activeProcurementCases: procurementCases.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.lifecycleStatus)).length,
      registeredSuppliers: suppliers.filter((supplier) => supplier.active && !supplier.archived).length,
      quotesAwaitingClientDecision: supplierQuotes.filter((quote) => quote.quoteState === "SUBMITTED" || quote.quoteState === "PREFERRED").length,
      vehiclesPendingDelivery: procurementCases.filter((item) => item.lifecycleStatus === "DELIVERY_PENDING" || item.lifecycleStatus === "VEHICLE_ORDERED").reduce((sum, item) => sum + item.vehicleQuantity, 0),
    },
  };
}

export async function uploadVehicleFinanceDocument(args: {
  applicationId: string;
  documentType: VehicleFinanceDocumentType;
  fileName: string;
  fileBuffer: Buffer;
}, actor: ActorContext) {
  const extraction = await extractTextFromPdfDetailed(args.fileBuffer, {
    filename: args.fileName,
    documentType: args.documentType,
    storagePath: `vehicle-finance/${args.applicationId}/${args.fileName}`,
    skipOcrFallback: true,
  });

  const extractedText = extraction.text ?? "";
  const finalDirectTextLength = extraction.directTextLength;
  const finalOcrTextLength = extraction.ocrTextLength;
  const finalExtractionSource = extraction.source;
  const documentAnalysis = buildDocumentAnalysis({
    documentType: args.documentType,
    extractedText,
    directTextLength: extraction.directTextLength,
    ocrTextLength: extraction.ocrTextLength,
    pageCount: extraction.pageCount,
    extractionSource: extraction.source,
  });
  const featureFlags = getVehicleFinanceFeatureFlags();

  const saved = await saveVehicleFinanceDocument({
    applicationId: args.applicationId,
    documentType: args.documentType,
    fileName: args.fileName,
    fileBuffer: args.fileBuffer,
    extractedText,
    directTextLength: finalDirectTextLength,
    ocrTextLength: finalOcrTextLength,
    pageCount: extraction.pageCount,
    extractionSource: finalExtractionSource,
    aiAnalysis: documentAnalysis,
  });

  await safeRecordAuditEvent({
    eventType: "VEHICLE_FINANCE_DOCUMENT_UPLOADED",
    actor,
    applicationId: args.applicationId,
    targetId: saved.record.documentId,
    newValue: saved.record,
    metadata: documentAnalysis,
  });

  let intelligenceJob: Awaited<ReturnType<typeof queueVehicleFinanceDriverLicenceIntelligence>> | null = null;
  if (featureFlags.ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE && args.documentType === "driversLicense") {
    try {
      intelligenceJob = await queueVehicleFinanceDriverLicenceIntelligence(args.applicationId, saved.record.documentId);
      console.log("[INTELLIGENCE_JOB_QUEUED]", {
        applicationId: args.applicationId,
        documentId: saved.record.documentId,
        jobId: intelligenceJob.jobId,
      });
    } catch (error) {
      console.warn("[vehicle-finance] driver licence intelligence queue failed", {
        applicationId: args.applicationId,
        documentType: args.documentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let identityIntelligenceJob: Awaited<ReturnType<typeof queueVehicleFinanceIdentityIntelligence>> | null = null;
  if (args.documentType === "greenIdBook" || args.documentType === "smartIdCard") {
    try {
      identityIntelligenceJob = await queueVehicleFinanceIdentityIntelligence(args.applicationId, saved.record.documentId);
      console.log("[IDENTITY_INTELLIGENCE_JOB_QUEUED]", {
        applicationId: args.applicationId,
        documentId: saved.record.documentId,
        jobId: identityIntelligenceJob.jobId,
      });
    } catch (error) {
      console.warn("[vehicle-finance] identity intelligence queue failed", {
        applicationId: args.applicationId,
        documentType: args.documentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let payslipIntelligenceJob: Awaited<ReturnType<typeof queueVehicleFinancePayslipIntelligence>> | null = null;
  if (args.documentType === "payslip") {
    try {
      payslipIntelligenceJob = await queueVehicleFinancePayslipIntelligence(args.applicationId, saved.record.documentId);
      console.log("[PAYSLIP_INTELLIGENCE_JOB_QUEUED]", {
        applicationId: args.applicationId,
        documentId: saved.record.documentId,
        jobId: payslipIntelligenceJob.jobId,
      });
    } catch (error) {
      console.warn("[vehicle-finance] payslip intelligence queue failed", {
        applicationId: args.applicationId,
        documentType: args.documentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let bankStatementIntelligenceJob: Awaited<ReturnType<typeof queueVehicleFinanceBankStatementIntelligence>> | null = null;
  if (args.documentType === "bankStatement") {
    try {
      bankStatementIntelligenceJob = await queueVehicleFinanceBankStatementIntelligence(args.applicationId, saved.record.documentId);
      console.log("[BANK_STATEMENT_INTELLIGENCE_JOB_QUEUED]", {
        applicationId: args.applicationId,
        documentId: saved.record.documentId,
        jobId: bankStatementIntelligenceJob.jobId,
      });
    } catch (error) {
      console.warn("[vehicle-finance] bank statement intelligence queue failed", {
        applicationId: args.applicationId,
        documentType: args.documentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await safeRecordSystemMetric({
    metricType: "vehicle_finance_document_upload",
    route: "vehicle-finance.documents.upload",
    durationMs: 0,
    applicationId: args.applicationId,
    targetId: saved.record.documentId,
    metadata: { documentType: args.documentType, extractionSource: extraction.source },
  });

  return {
    ...saved.record,
    signedUrl: saved.signedUrl,
    intelligenceJob: intelligenceJob ?? payslipIntelligenceJob ?? bankStatementIntelligenceJob,
    identityIntelligenceJob,
  };
}

export async function runVehicleFinanceAssessment(applicationId: string, actor: ActorContext) {
  return recalculateApplicationAssessment(applicationId, actor);
}

export async function generateVehicleFinanceCertificate(applicationId: string, actor: ActorContext) {
  const db = getFirebaseAdmin();
  const [applicationSnapshot, assessmentSnapshot, customerSnapshot, documentSnapshot] = await Promise.all([
    db.collection(APPLICATION_COLLECTION).doc(applicationId).get(),
    db.collection(ASSESSMENT_COLLECTION).doc(applicationId).get(),
    db.collection(APPLICATION_COLLECTION).doc(applicationId).get().then(async (appSnap) => {
      const appData = (appSnap.data() ?? {}) as Record<string, unknown>;
      const customerId = asString(appData.customerId);
      return customerId ? db.collection(CUSTOMER_COLLECTION).doc(customerId).get() : null;
    }),
    db.collection(DOCUMENT_COLLECTION).where("applicationId", "==", applicationId).get(),
  ]);

  if (!applicationSnapshot.exists) {
    throw new Error("Vehicle finance application not found");
  }

  const application = normalizeApplicationData(applicationId, (applicationSnapshot.data() ?? {}) as Record<string, unknown>);
  const assessment = assessmentSnapshot.exists
    ? normalizeAssessmentData((assessmentSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;
  const customer = customerSnapshot?.exists
    ? normalizeCustomerData(customerSnapshot.id, (customerSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;
  const documents = documentSnapshot.docs.map((doc) => normalizeDocumentData(doc.id, (doc.data() ?? {}) as Record<string, unknown>));

  if (!assessment || !customer) {
    throw new Error("Vehicle finance assessment is incomplete");
  }

  const certificateId = crypto.randomUUID();
  const certificatePath = `vehicle-finance/certificates/${certificateId}.pdf`;
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(certificatePath);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Vehicle Finance Verification Certificate", 40, 50);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  const lines = [
    `Customer: ${getDisplayName(customer.firstName, customer.lastName)}`,
    `Customer ID: ${customer.customerId}`,
    `Application ID: ${application.applicationId}`,
    `Dealer: ${application.dealerName}`,
    `Vehicle ID: ${application.vehicleId}`,
    `Verification Status: ${assessment.verificationStatus}`,
    `Risk Level: ${assessment.riskLevel}`,
    `Fraud Score: ${assessment.overallFraudScore}`,
    `Verified By: ${actor.actorName ?? actor.actorId ?? "system"}`,
    `Verification Date: ${new Date().toISOString()}`,
    "",
    "Scores",
    `Identity: ${assessment.identityScore}`,
    `Income: ${assessment.incomeScore}`,
    `Bank: ${assessment.bankScore}`,
    `Integrity: ${assessment.documentIntegrityScore}`,
    "",
    "Documents Reviewed",
    ...documents.map((document) => `- ${document.documentType}: ${document.fileName}`),
  ];

  let y = 84;
  for (const line of lines) {
    if (y > 760) {
      pdf.addPage();
      y = 48;
    }
    pdf.text(line || " ", 40, y);
    y += 16;
  }

  const bytes = Buffer.from(pdf.output("arraybuffer"));
  await file.save(bytes, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
    },
  });

  const [certificateUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  const createdAt = new Date().toISOString();
  const certificate: VehicleFinanceCertificate = {
    certificateId,
    applicationId,
    certificateUrl,
    certificatePath,
    verificationDate: createdAt,
    verifiedBy: actor.actorName ?? actor.actorId ?? "system",
    createdAt,
  };

  await db.collection(CERTIFICATE_COLLECTION).doc(certificateId).set(certificate);
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).set(
    {
      verificationStatus: "VERIFIED",
      applicationStatus: "VERIFIED",
      updatedAt: createdAt,
    },
    { merge: true },
  );

  await safeRecordAuditEvent({
    eventType: "VEHICLE_FINANCE_CERTIFICATE_GENERATED",
    actor,
    applicationId,
    targetId: certificateId,
    newValue: certificate,
    metadata: { documentCount: documents.length },
  });

  await safeRecordSystemMetric({
    metricType: "vehicle_finance_certificate_generation",
    route: "vehicle-finance.certificates.generate",
    durationMs: 0,
    applicationId,
    targetId: certificateId,
  });

  return certificate;
}

export async function buildVehicleFinanceCsv() {
  const overview = await getVehicleFinanceOverview();
  const rows = [
    ["section", "name", "value", "timestamp"],
    ...Object.entries(overview.metrics).map(([key, value]) => ["metric", key, String(value), new Date().toISOString()]),
    ...overview.applications.map((application) => [
      "application",
      application.applicationId,
      `${application.applicationStatus} | ${application.verificationStatus}`,
      application.updatedAt,
    ]),
  ];

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function buildVehicleFinanceExcel() {
  const overview = await getVehicleFinanceOverview();
  const rows = [
    ["section", "name", "value", "timestamp"],
    ...Object.entries(overview.metrics).map(([key, value]) => ["metric", key, String(value), new Date().toISOString()]),
    ...overview.applications.map((application) => [
      "application",
      application.applicationId,
      `${application.applicationStatus} | ${application.verificationStatus}`,
      application.updatedAt,
    ]),
  ];

  const sheetRows = rows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${String(cell).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Vehicle Finance">
  <Table>${sheetRows}</Table>
 </Worksheet>
</Workbook>`;
}

export async function buildVehicleFinancePdf() {
  const overview = await getVehicleFinanceOverview();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Vehicle Finance Report", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines = [
    `Generated: ${new Date().toISOString()}`,
    `Total Applications: ${overview.metrics.totalApplications}`,
    `Pending Verification: ${overview.metrics.pendingVerification}`,
    `Verified Applications: ${overview.metrics.verifiedApplications}`,
    `Fraud Alerts: ${overview.metrics.fraudAlerts}`,
    `Approval Ratio: ${overview.metrics.approvalRatio}%`,
    `Monthly Deal Value: R${overview.metrics.monthlyDealValue.toLocaleString("en-ZA")}`,
    "",
    "Recent Applications",
    ...overview.applications.slice(0, 20).map((application) => `${application.applicationId} | ${application.customerId} | ${application.verificationStatus} | ${application.fraudScore}`),
  ];

  let y = 80;
  for (const line of lines) {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.text(line || " ", 40, y);
    y += 16;
  }

  return doc.output("arraybuffer");
}

export async function getVehicleFinanceAuditTrail(applicationId: string) {
  const [auditSnapshot, decisionSnapshot, assessmentSnapshot] = await Promise.all([
    getFirebaseAdmin().collection("auditLogs").where("applicationId", "==", applicationId).limit(100).get(),
    getFirebaseAdmin().collection("decisionLogs").where("applicationId", "==", applicationId).limit(100).get(),
    getFirebaseAdmin().collection(ASSESSMENT_COLLECTION).doc(applicationId).get(),
  ]);

  type TimelineEntry = { id: string; timestamp?: unknown } & Record<string, unknown>;

  const sortByTimestampDesc = (left: TimelineEntry, right: TimelineEntry) => {
    const leftValue = left.timestamp && typeof left.timestamp === "object" && "toMillis" in left.timestamp
      ? (left.timestamp as { toMillis: () => number }).toMillis()
      : typeof left.timestamp === "number"
        ? left.timestamp
        : typeof left.timestamp === "string"
          ? Date.parse(left.timestamp)
          : 0;
    const rightValue = right.timestamp && typeof right.timestamp === "object" && "toMillis" in right.timestamp
      ? (right.timestamp as { toMillis: () => number }).toMillis()
      : typeof right.timestamp === "number"
        ? right.timestamp
        : typeof right.timestamp === "string"
          ? Date.parse(right.timestamp)
          : 0;

    return rightValue - leftValue;
  };

  const auditLogs: TimelineEntry[] = auditSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) }) as TimelineEntry);
  const decisionLogs: TimelineEntry[] = decisionSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) }) as TimelineEntry);

  return {
    auditLogs: auditLogs.sort(sortByTimestampDesc),
    decisionLogs: decisionLogs.sort(sortByTimestampDesc),
    assessment: assessmentSnapshot.exists ? normalizeAssessmentData((assessmentSnapshot.data() ?? {}) as Record<string, unknown>) : null,
  };
}

export class VehicleFinanceProcurementValidationError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.name = "VehicleFinanceProcurementValidationError"; this.status = status; } } const BUSINESS_CLIENT_COLLECTION = "vehicleFinanceBusinessClients"; const SUPPLIER_COLLECTION = "vehicleFinanceSuppliers"; const PROCUREMENT_CASE_COLLECTION = "vehicleFinanceProcurementCases"; const SUPPLIER_QUOTE_COLLECTION = "vehicleFinanceSupplierQuotes"; const VEHICLE_FINANCE_OPERATING_DIVISION = "Torque Empire Car Division"; const BUSINESS_CLIENT_STATUSES = ["ACTIVE", "ON_HOLD", "SUSPENDED", "ARCHIVED"]; const SUPPLIER_STATUSES = ["PROSPECT", "CONFIRMED", "PREFERRED", "ON_HOLD", "ARCHIVED"]; const SUPPLIER_CATEGORIES = ["DEALER", "OEM", "BROKER", "FLEET_PARTNER", "OTHER"]; const SUPPLIER_CLASSIFICATIONS = ["FRANCHISE", "INDEPENDENT", "OTHER"]; const CASE_STATUSES = ["DRAFT", "REQUIREMENT_CONFIRMED", "SOURCING", "QUOTES_RECEIVED", "CLIENT_REVIEW", "CLIENT_APPROVED", "ORDER_CONFIRMED", "VEHICLE_ORDERED", "DELIVERY_PENDING", "DELIVERED", "COMPLETED", "CANCELLED", "ON_HOLD"]; const PURCHASE_METHODS = ["CASH", "FINANCE", "LEASE", "PURCHASE_ORDER", "OTHER"]; const PROCUREMENT_CONDITIONS = ["NEW", "DEMO", "USED"]; const QUOTE_STATES = ["SUBMITTED", "PREFERRED", "SELECTED", "DECLINED", "EXPIRED"]; const PARTNER_VISIBLE_STATUSES = ["QUOTE_RECEIVED", "UNDER_REVIEW", "SUBMITTED_TO_CLIENT", "CLIENT_REVIEW", "REVISION_REQUESTED", "AWAITING_CLIENT_DECISION", "SELECTED", "ORDER_PENDING", "ORDER_CONFIRMED", "DELIVERY_PENDING", "DELIVERED", "COMPLETED", "NOT_SELECTED", "CANCELLED"];
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  return asString(value).split(",").map((item) => item.trim()).filter(Boolean);
}
function requireProcurementString(value: unknown, label: string): string {
  const text = asString(value);
  if (!text) throw new VehicleFinanceProcurementValidationError(label + " is required");
  return text;
}
function procurementEnum(value: unknown, allowed: readonly string[], fallback: string, label: string): any {
  const text = asString(value).toUpperCase();
  if (!text) return fallback;
  if (!allowed.includes(text)) throw new VehicleFinanceProcurementValidationError("Invalid " + label);
  return text;
}
function procurementNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeBusinessClientData(id: string, data: Record<string, unknown>): import("@/types/vehicleFinance").VehicleFinanceBusinessClient {
  return { businessClientId: id, legalName: asString(data.legalName), tradingName: asString(data.tradingName) || null, registrationNumber: asString(data.registrationNumber), vatNumber: asString(data.vatNumber) || null, industry: asString(data.industry) || null, accountStatus: procurementEnum(data.accountStatus, BUSINESS_CLIENT_STATUSES, "ACTIVE", "account status"), primaryContact: asString(data.primaryContact), procurementContact: asString(data.procurementContact) || null, phone: asString(data.phone), email: asString(data.email), registeredAddress: asString(data.registeredAddress) || null, billingAddress: asString(data.billingAddress) || null, accountManager: asString(data.accountManager) || null, preferredTransactionMethod: asString(data.preferredTransactionMethod) || null, procurementNotes: asString(data.procurementNotes) || null, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt ?? data.createdAt), createdBy: asString(data.createdBy) || null, updatedBy: asString(data.updatedBy) || null, operatingDivision: asString(data.operatingDivision) || null };
}
function normalizeSupplierData(id: string, data: Record<string, unknown>): import("@/types/vehicleFinance").VehicleFinanceSupplier {
  return { supplierId: id, legalName: asString(data.legalName), tradingName: asString(data.tradingName) || null, supplierCategory: procurementEnum(data.supplierCategory, SUPPLIER_CATEGORIES, "DEALER", "supplier category"), classification: procurementEnum(data.classification, SUPPLIER_CLASSIFICATIONS, "INDEPENDENT", "supplier classification"), brandsRepresented: asStringList(data.brandsRepresented), branchLocation: asString(data.branchLocation) || null, primarySalesContact: asString(data.primarySalesContact), fleetContact: asString(data.fleetContact) || null, email: asString(data.email), phone: asString(data.phone), relationshipStatus: procurementEnum(data.relationshipStatus, SUPPLIER_STATUSES, "PROSPECT", "relationship status"), preferredSupplier: data.preferredSupplier === true, quoteTurnaroundNotes: asString(data.quoteTurnaroundNotes) || null, geographicCoverage: asString(data.geographicCoverage) || null, commercialNotes: asString(data.commercialNotes) || null, active: data.active !== false, archived: data.archived === true, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt ?? data.createdAt), createdBy: asString(data.createdBy) || null, updatedBy: asString(data.updatedBy) || null, operatingDivision: asString(data.operatingDivision) || null };
}
function normalizePartnerActivity(value: unknown): import("@/types/vehicleFinance").VehicleFinancePartnerActivity[] {
  const history = Array.isArray(value) ? value as any[] : [];
  return history.map((item) => ({ status: procurementEnum(item?.status, PARTNER_VISIBLE_STATUSES, "UNDER_REVIEW", "partner visible status"), timestamp: toIso(item?.timestamp), actorId: asString(item?.actorId) || null, actorName: asString(item?.actorName) || null, note: asString(item?.note) })).filter((item) => item.note || item.status);
}
function normalizeSupplierQuoteDocuments(value: unknown): import("@/types/vehicleFinance").VehicleFinanceSupplierQuoteDocument[] {
  const documents = Array.isArray(value) ? value as any[] : [];
  return documents.map((item) => ({ documentId: asString(item?.documentId) || crypto.randomUUID(), fileName: asString(item?.fileName), fileUrl: asString(item?.fileUrl) || null, storagePath: asString(item?.storagePath) || null, uploadedAt: toIso(item?.uploadedAt), uploadedBy: asString(item?.uploadedBy) || null, notes: asString(item?.notes) || null })).filter((item) => item.fileName && (item.fileUrl || item.storagePath));
}
function normalizeProcurementCaseData(id: string, data: Record<string, unknown>): import("@/types/vehicleFinance").VehicleFinanceProcurementCase {
  const history = Array.isArray(data.activityHistory) ? data.activityHistory as any[] : [];
  const lifecycleStatus = procurementEnum(data.lifecycleStatus ?? data.internalStatus, CASE_STATUSES, "DRAFT", "lifecycle status");
  return { procurementCaseId: id, businessClientId: asString(data.businessClientId), clientRequestor: asString(data.clientRequestor), internalReference: asString(data.internalReference), clientReferenceNumber: asString(data.clientReferenceNumber) || null, accountOwner: asString(data.accountOwner), vehicleQuantity: Math.max(1, Math.round(procurementNumber(data.vehicleQuantity, 1))), make: asString(data.make), model: asString(data.model), variant: asString(data.variant) || null, fuelType: asString(data.fuelType) || null, colour: asString(data.colour) || null, requiredSpecifications: asString(data.requiredSpecifications) || null, condition: procurementEnum(data.condition, PROCUREMENT_CONDITIONS, "NEW", "condition"), purchaseMethod: procurementEnum(data.purchaseMethod, PURCHASE_METHODS, "OTHER", "purchase method"), budget: procurementNumber(data.budget, 0) || null, requiredDeliveryDate: asString(data.requiredDeliveryDate) || null, notes: asString(data.notes) || null, internalStatus: procurementEnum(data.internalStatus ?? lifecycleStatus, CASE_STATUSES, lifecycleStatus, "internal status"), partnerVisibleStatus: procurementEnum(data.partnerVisibleStatus, PARTNER_VISIBLE_STATUSES, "UNDER_REVIEW", "partner visible status"), lifecycleStatus, partnerPublicationSequence: Number.isSafeInteger(data.partnerPublicationSequence) && Number(data.partnerPublicationSequence) >= 0 ? Number(data.partnerPublicationSequence) : 0, activityHistory: history.map((item) => ({ status: procurementEnum(item?.status, CASE_STATUSES, "DRAFT", "activity status"), timestamp: toIso(item?.timestamp), actorId: asString(item?.actorId) || null, actorName: asString(item?.actorName) || null, note: asString(item?.note) })).filter((item) => item.note || item.status), createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt ?? data.createdAt), createdBy: asString(data.createdBy) || null, updatedBy: asString(data.updatedBy) || null, operatingDivision: asString(data.operatingDivision) || null };
}
function normalizeSupplierQuoteData(id: string, data: Record<string, unknown>): import("@/types/vehicleFinance").VehicleFinanceSupplierQuote {
  return { supplierQuoteId: id, supplierId: asString(data.supplierId), procurementCaseId: asString(data.procurementCaseId), vehicleDescription: asString(data.vehicleDescription), quotedAmount: procurementNumber(data.quotedAmount), availability: asString(data.availability), quoteDate: toIso(data.quoteDate), quoteExpiry: asString(data.quoteExpiry) || null, supplierReference: asString(data.supplierReference) || null, colourSpecification: asString(data.colourSpecification) || null, quoteState: procurementEnum(data.quoteState, QUOTE_STATES, "SUBMITTED", "quote state"), notes: asString(data.notes) || null, internalNotes: asString(data.internalNotes) || null, partnerVisibleStatus: procurementEnum(data.partnerVisibleStatus, PARTNER_VISIBLE_STATUSES, "QUOTE_RECEIVED", "partner visible status"), partnerVisibleStatusUpdatedAt: asString(data.partnerVisibleStatusUpdatedAt) || null, partnerVisibleStatusUpdatedBy: asString(data.partnerVisibleStatusUpdatedBy) || null, messageTemplateId: asString(data.messageTemplateId) || null, renderedPartnerMessage: asString(data.renderedPartnerMessage) || null, publishedAt: asString(data.publishedAt) || null, publishedBy: asString(data.publishedBy) || null, partnerPublicationOrder: Number.isSafeInteger(data.partnerPublicationOrder) && Number(data.partnerPublicationOrder) > 0 ? Number(data.partnerPublicationOrder) : null, stockAvailability: asString(data.stockAvailability) || asString(data.availability) || null, expectedDeliveryDate: asString(data.expectedDeliveryDate) || null, colourSpecificationConfirmed: data.colourSpecificationConfirmed === true, partnerNotes: asString(data.partnerNotes) || null, revisionRequestOpen: data.revisionRequestOpen === true, supportingDocuments: normalizeSupplierQuoteDocuments(data.supportingDocuments), partnerActivityHistory: normalizePartnerActivity(data.partnerActivityHistory), createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt ?? data.createdAt), createdBy: asString(data.createdBy) || null, updatedBy: asString(data.updatedBy) || null, operatingDivision: asString(data.operatingDivision) || null };
}
async function assertProcurementDocument(collection: string, id: string, label: string) {
  const snapshot = await getFirebaseAdmin().collection(collection).doc(id).get();
  if (!snapshot.exists) throw new VehicleFinanceProcurementValidationError(label + " not found", 409);
  return snapshot;
}
export async function listVehicleFinanceBusinessClients(): Promise<import("@/types/vehicleFinance").VehicleFinanceBusinessClient[]> {
  const snapshot = await getFirebaseAdmin().collection(BUSINESS_CLIENT_COLLECTION).limit(500).get();
  return snapshot.docs.map((doc) => normalizeBusinessClientData(doc.id, (doc.data() ?? {}) as Record<string, unknown>)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
export async function createVehicleFinanceBusinessClient(input: Record<string, unknown>, actor: ActorContext): Promise<import("@/types/vehicleFinance").VehicleFinanceBusinessClient> {
  const now = new Date().toISOString(); const businessClientId = crypto.randomUUID();
  const record = normalizeBusinessClientData(businessClientId, { ...input, legalName: requireProcurementString(input.legalName, "Legal name"), registrationNumber: requireProcurementString(input.registrationNumber, "Registration number"), primaryContact: requireProcurementString(input.primaryContact, "Primary contact"), phone: requireProcurementString(input.phone, "Phone"), email: requireProcurementString(input.email, "Email"), createdAt: now, updatedAt: now, createdBy: actor.actorId ?? null, updatedBy: actor.actorId ?? null, operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION });
  await getFirebaseAdmin().collection(BUSINESS_CLIENT_COLLECTION).doc(businessClientId).set(record);
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_BUSINESS_CLIENT_CREATED", actor, targetId: businessClientId, newValue: record, metadata: { module: "vehicle-finance-procurement", entityType: "businessClient" } });
  return record;
}
export async function listVehicleFinanceSuppliers(): Promise<import("@/types/vehicleFinance").VehicleFinanceSupplier[]> {
  const snapshot = await getFirebaseAdmin().collection(SUPPLIER_COLLECTION).limit(500).get();
  return snapshot.docs.map((doc) => normalizeSupplierData(doc.id, (doc.data() ?? {}) as Record<string, unknown>)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
export async function createVehicleFinanceSupplier(input: Record<string, unknown>, actor: ActorContext): Promise<import("@/types/vehicleFinance").VehicleFinanceSupplier> {
  const now = new Date().toISOString();
  const supplierId = crypto.randomUUID();
  const record = normalizeSupplierData(supplierId, { ...input, legalName: requireProcurementString(input.legalName, "Supplier legal name"), primarySalesContact: requireProcurementString(input.primarySalesContact, "Primary sales contact"), email: requireProcurementString(input.email, "Email"), phone: requireProcurementString(input.phone, "Phone"), createdAt: now, updatedAt: now, createdBy: actor.actorId ?? null, updatedBy: actor.actorId ?? null, operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION, active: input.active !== false, archived: input.archived === true });
  await getFirebaseAdmin().collection(SUPPLIER_COLLECTION).doc(supplierId).set(record);
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_SUPPLIER_CREATED", actor, targetId: supplierId, newValue: record, metadata: { module: "vehicle-finance-procurement", entityType: "supplier" } });
  return record;
}
export async function listVehicleFinanceProcurementCases(): Promise<import("@/types/vehicleFinance").VehicleFinanceProcurementCase[]> {
  const snapshot = await getFirebaseAdmin().collection(PROCUREMENT_CASE_COLLECTION).limit(500).get();
  return snapshot.docs.map((doc) => normalizeProcurementCaseData(doc.id, (doc.data() ?? {}) as Record<string, unknown>)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
export async function createVehicleFinanceProcurementCase(input: Record<string, unknown>, actor: ActorContext): Promise<import("@/types/vehicleFinance").VehicleFinanceProcurementCase> {
  const businessClientId = requireProcurementString(input.businessClientId, "Business client");
  const businessClientSnapshot = await assertProcurementDocument(BUSINESS_CLIENT_COLLECTION, businessClientId, "Business client");
  const businessClient = normalizeBusinessClientData(businessClientSnapshot.id, (businessClientSnapshot.data() ?? {}) as Record<string, unknown>);
  if (businessClient.accountStatus === "ARCHIVED" || businessClient.accountStatus === "SUSPENDED") throw new VehicleFinanceProcurementValidationError("Business client is not eligible for new procurement cases", 409);
  const now = new Date().toISOString(); const procurementCaseId = crypto.randomUUID();
  const activityHistory = [{ status: "DRAFT", timestamp: now, actorId: actor.actorId ?? null, actorName: actor.actorName ?? null, note: "Procurement case created" }];
  const record = normalizeProcurementCaseData(procurementCaseId, { ...input, businessClientId, clientRequestor: requireProcurementString(input.clientRequestor, "Client requestor"), internalReference: requireProcurementString(input.internalReference, "Internal reference"), accountOwner: requireProcurementString(input.accountOwner, "Account owner"), make: requireProcurementString(input.make, "Make"), model: requireProcurementString(input.model, "Model"), lifecycleStatus: "DRAFT", internalStatus: "DRAFT", partnerVisibleStatus: "UNDER_REVIEW", activityHistory, createdAt: now, updatedAt: now, createdBy: actor.actorId ?? null, updatedBy: actor.actorId ?? null, operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION });
  await getFirebaseAdmin().collection(PROCUREMENT_CASE_COLLECTION).doc(procurementCaseId).set(record);
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_PROCUREMENT_CASE_CREATED", actor, targetId: procurementCaseId, newValue: record, metadata: { module: "vehicle-finance-procurement", businessClientId } });
  return record;
}
const PROCUREMENT_STATUS_NEXT: Record<string, string[]> = { DRAFT: ["REQUIREMENT_CONFIRMED", "ON_HOLD", "CANCELLED"], REQUIREMENT_CONFIRMED: ["SOURCING", "ON_HOLD", "CANCELLED"], SOURCING: ["QUOTES_RECEIVED", "ON_HOLD", "CANCELLED"], QUOTES_RECEIVED: ["CLIENT_REVIEW", "ON_HOLD", "CANCELLED"], CLIENT_REVIEW: ["CLIENT_APPROVED", "ON_HOLD", "CANCELLED"], CLIENT_APPROVED: ["ORDER_CONFIRMED", "ON_HOLD", "CANCELLED"], ORDER_CONFIRMED: ["VEHICLE_ORDERED", "ON_HOLD", "CANCELLED"], VEHICLE_ORDERED: ["DELIVERY_PENDING", "ON_HOLD", "CANCELLED"], DELIVERY_PENDING: ["DELIVERED", "ON_HOLD", "CANCELLED"], DELIVERED: ["COMPLETED"], ON_HOLD: ["DRAFT", "REQUIREMENT_CONFIRMED", "SOURCING", "QUOTES_RECEIVED", "CLIENT_REVIEW", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
const PARTNER_VISIBLE_STATUS_NEXT: Record<string, string[]> = {
  "QUOTE_RECEIVED": [
    "UNDER_REVIEW",
    "REVISION_REQUESTED",
    "CANCELLED"
  ],
  "UNDER_REVIEW": [
    "SUBMITTED_TO_CLIENT",
    "REVISION_REQUESTED",
    "NOT_SELECTED",
    "CANCELLED"
  ],
  "SUBMITTED_TO_CLIENT": [
    "CLIENT_REVIEW",
    "AWAITING_CLIENT_DECISION",
    "REVISION_REQUESTED",
    "NOT_SELECTED",
    "CANCELLED"
  ],
  "CLIENT_REVIEW": [
    "AWAITING_CLIENT_DECISION",
    "REVISION_REQUESTED",
    "SELECTED",
    "NOT_SELECTED",
    "CANCELLED"
  ],
  "REVISION_REQUESTED": [
    "QUOTE_RECEIVED",
    "UNDER_REVIEW",
    "CANCELLED"
  ],
  "AWAITING_CLIENT_DECISION": [
    "SELECTED",
    "NOT_SELECTED",
    "REVISION_REQUESTED",
    "CANCELLED"
  ],
  "SELECTED": [
    "ORDER_PENDING",
    "ORDER_CONFIRMED",
    "CANCELLED"
  ],
  "ORDER_PENDING": [
    "ORDER_CONFIRMED",
    "CANCELLED"
  ],
  "ORDER_CONFIRMED": [
    "DELIVERY_PENDING",
    "CANCELLED"
  ],
  "DELIVERY_PENDING": [
    "DELIVERED",
    "CANCELLED"
  ],
  "DELIVERED": [
    "COMPLETED"
  ],
  "COMPLETED": [],
  "NOT_SELECTED": [],
  "CANCELLED": []
};
const PARTNER_STATUS_PUBLISHER_ROLES = new Set(["admin", "manager", "staff", "vehicleFinanceStaff", "ROAR_CARS_STAFF", "dealerPilot"]);
const PARTNER_PUBLICATION_NOTE_BLOCKLIST = [/\bmargin\b/i, /\bmarkup\b/i, /\bprofit\b/i, /\bcompetitor\b/i, /\bsupplier\s+[a-z0-9-]+\b/i, /\bclient\s+budget\b/i, /\bbudget\b/i, /\binternal\s+note/i, /\binternal\s+scor/i, /\bscoring\b/i, /\bevaluation\b/i, /\bconfidential\b/i, /\bregistration\s+number\b/i, /\bvat\b/i, /\bbusinessClientId\b/i, /\bclientRequestor\b/i];
function assertPartnerVisibleStatusPublisher(actor: ActorContext) {
  if (!actor.actorRole || !PARTNER_STATUS_PUBLISHER_ROLES.has(actor.actorRole)) throw new VehicleFinanceProcurementValidationError("unauthorized", 403);
}
function sanitizePartnerPublicationNote(value: unknown): string | null {
  const note = asString(value).replace(/\s+/g, " " ).slice(0, 500);
  if (!note) return null;
  if (PARTNER_PUBLICATION_NOTE_BLOCKLIST.some((pattern) => pattern.test(note))) throw new VehicleFinanceProcurementValidationError("Supplier-visible note contains restricted information");
  return note;
}
function resolvePartnerPublicationMessage(status: import("@/types/vehicleFinance").VehicleFinancePartnerVisibleStatus, input: Record<string, unknown>) {
  const messageTemplateId = requireProcurementString(input.messageTemplateId, "Message template");
  const template = VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES.find((item) => item.messageTemplateId === messageTemplateId);
  if (!template || template.status !== status) throw new VehicleFinanceProcurementValidationError("Invalid partner-visible message template");
  const customMessage = asString(input.reviewedCustomMessage);
  if (customMessage) {
    if (template.reviewedCustomTextAllowed !== true || input.reviewedCustomMessageApproved !== true) throw new VehicleFinanceProcurementValidationError("Reviewed custom partner message is not enabled for this template");
    return { messageTemplateId, renderedPartnerMessage: sanitizePartnerPublicationNote(customMessage) || template.message };
  }
  return { messageTemplateId, renderedPartnerMessage: template.message };
}
export async function updateVehicleFinanceProcurementCaseLifecycle(procurementCaseId: string, nextStatus: string, actor: ActorContext, note = "Lifecycle updated"): Promise<import("@/types/vehicleFinance").VehicleFinanceProcurementCase> {
  const caseSnapshot = await assertProcurementDocument(PROCUREMENT_CASE_COLLECTION, procurementCaseId, "Procurement case");
  const current = normalizeProcurementCaseData(caseSnapshot.id, (caseSnapshot.data() ?? {}) as Record<string, unknown>);
  const requested = procurementEnum(nextStatus, CASE_STATUSES, current.lifecycleStatus, "lifecycle status");
  if (requested === current.lifecycleStatus) return current;
  if (!(PROCUREMENT_STATUS_NEXT[current.lifecycleStatus] ?? []).includes(requested)) throw new VehicleFinanceProcurementValidationError("Invalid procurement lifecycle transition", 409);
  const now = new Date().toISOString();
  const history = [...current.activityHistory, { status: requested, timestamp: now, actorId: actor.actorId ?? null, actorName: actor.actorName ?? null, note }];
  const record = { ...current, lifecycleStatus: requested, activityHistory: history, updatedAt: now, updatedBy: actor.actorId ?? null };
  await getFirebaseAdmin().collection(PROCUREMENT_CASE_COLLECTION).doc(procurementCaseId).set(record, { merge: true });
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_PROCUREMENT_CASE_LIFECYCLE_UPDATED", actor, targetId: procurementCaseId, previousValue: current.lifecycleStatus, newValue: requested, metadata: { module: "vehicle-finance-procurement", note } });
  return record;
}
export async function listVehicleFinanceSupplierQuotes(procurementCaseId?: string): Promise<import("@/types/vehicleFinance").VehicleFinanceSupplierQuote[]> {
  const query = procurementCaseId ? getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).where("procurementCaseId", "==", procurementCaseId) : getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION);
  const snapshot = await query.limit(500).get();
  return snapshot.docs.map((doc) => normalizeSupplierQuoteData(doc.id, (doc.data() ?? {}) as Record<string, unknown>)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
export async function createVehicleFinanceSupplierQuote(input: Record<string, unknown>, actor: ActorContext): Promise<import("@/types/vehicleFinance").VehicleFinanceSupplierQuote> {
  const supplierId = requireProcurementString(input.supplierId, "Supplier");
  const procurementCaseId = requireProcurementString(input.procurementCaseId, "Procurement case");
  const [supplierSnapshot, caseSnapshot] = await Promise.all([assertProcurementDocument(SUPPLIER_COLLECTION, supplierId, "Supplier"), assertProcurementDocument(PROCUREMENT_CASE_COLLECTION, procurementCaseId, "Procurement case")]);
  const supplier = normalizeSupplierData(supplierSnapshot.id, (supplierSnapshot.data() ?? {}) as Record<string, unknown>);
  const procurementCase = normalizeProcurementCaseData(caseSnapshot.id, (caseSnapshot.data() ?? {}) as Record<string, unknown>);
  if (!supplier.active || supplier.archived || supplier.relationshipStatus === "ARCHIVED") throw new VehicleFinanceProcurementValidationError("Supplier is not active for quotation linking", 409);
  if (procurementCase.lifecycleStatus === "CANCELLED" || procurementCase.lifecycleStatus === "COMPLETED") throw new VehicleFinanceProcurementValidationError("Procurement case is closed for quotation linking", 409);
  const now = new Date().toISOString(); const supplierQuoteId = crypto.randomUUID();
  const record = normalizeSupplierQuoteData(supplierQuoteId, { ...input, supplierId, procurementCaseId, vehicleDescription: requireProcurementString(input.vehicleDescription, "Vehicle description"), availability: requireProcurementString(input.availability, "Availability"), quotedAmount: procurementNumber(input.quotedAmount), quoteDate: input.quoteDate || now, quoteState: procurementEnum(input.quoteState, QUOTE_STATES, "SUBMITTED", "quote state"), partnerVisibleStatus: procurementEnum(input.partnerVisibleStatus, PARTNER_VISIBLE_STATUSES, "QUOTE_RECEIVED", "partner visible status"), stockAvailability: input.stockAvailability ?? input.availability, expectedDeliveryDate: input.expectedDeliveryDate, colourSpecificationConfirmed: input.colourSpecificationConfirmed === true, supportingDocuments: input.supportingDocuments, partnerActivityHistory: [{ status: "QUOTE_RECEIVED", timestamp: now, actorId: actor.actorId ?? null, actorName: actor.actorName ?? null, note: "Supplier quote received" }], createdAt: now, updatedAt: now, createdBy: actor.actorId ?? null, updatedBy: actor.actorId ?? null, operatingDivision: VEHICLE_FINANCE_OPERATING_DIVISION });
  if (record.quotedAmount <= 0) throw new VehicleFinanceProcurementValidationError("Quoted amount must be greater than zero");
  await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(supplierQuoteId).set(record);
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_SUPPLIER_QUOTE_CREATED", actor, targetId: supplierQuoteId, newValue: record, metadata: { module: "vehicle-finance-procurement", supplierId, procurementCaseId } });
  return record;
}


export async function publishVehicleFinancePartnerVisibleStatus(supplierQuoteId: string, input: Record<string, unknown>, actor: ActorContext): Promise<import("@/types/vehicleFinance").VehicleFinanceSupplierQuote> {
  assertPartnerVisibleStatusPublisher(actor);
  const db = getFirebaseAdmin();
  const quoteRef = db.collection(SUPPLIER_QUOTE_COLLECTION).doc(supplierQuoteId);
  const quoteSnapshot = await assertProcurementDocument(SUPPLIER_QUOTE_COLLECTION, supplierQuoteId, "Supplier quote");
  const current = normalizeSupplierQuoteData(quoteSnapshot.id, (quoteSnapshot.data() ?? {}) as Record<string, unknown>);
  const caseRef = db.collection(PROCUREMENT_CASE_COLLECTION).doc(current.procurementCaseId);
  await Promise.all([assertProcurementDocument(SUPPLIER_COLLECTION, current.supplierId, "Supplier"), assertProcurementDocument(PROCUREMENT_CASE_COLLECTION, current.procurementCaseId, "Procurement case")]);
  const requested = procurementEnum(input.partnerVisibleStatus ?? input.status, PARTNER_VISIBLE_STATUSES, "", "partner visible status") as import("@/types/vehicleFinance").VehicleFinancePartnerVisibleStatus;
  if (!requested) throw new VehicleFinanceProcurementValidationError("Partner-visible status is required");
  const sameStatus = requested === current.partnerVisibleStatus;
  if (!sameStatus && !(PARTNER_VISIBLE_STATUS_NEXT[current.partnerVisibleStatus] ?? []).includes(requested)) throw new VehicleFinanceProcurementValidationError("Invalid partner-visible status transition", 409);
  const publicationMessage = resolvePartnerPublicationMessage(requested, input);
  if (sameStatus && hasCompletePartnerPublication(current)) {
    if (current.messageTemplateId === publicationMessage.messageTemplateId && current.renderedPartnerMessage === publicationMessage.renderedPartnerMessage) return current;
    throw new VehicleFinanceProcurementValidationError("Conflicting partner-visible publication", 409);
  }
  const now = new Date().toISOString();
  const next = await db.runTransaction(async (transaction) => {
    const [freshQuoteSnapshot, caseSnapshot] = await Promise.all([transaction.get(quoteRef), transaction.get(caseRef)]);
    if (!freshQuoteSnapshot.exists || !caseSnapshot.exists) throw new VehicleFinanceProcurementValidationError("Publication record not found", 409);
    const fresh = normalizeSupplierQuoteData(freshQuoteSnapshot.id, (freshQuoteSnapshot.data() ?? {}) as Record<string, unknown>);
    const freshSameStatus = requested === fresh.partnerVisibleStatus;
    if (freshSameStatus && hasCompletePartnerPublication(fresh)) {
      if (fresh.messageTemplateId === publicationMessage.messageTemplateId && fresh.renderedPartnerMessage === publicationMessage.renderedPartnerMessage) return { publication: fresh, created: false };
      throw new VehicleFinanceProcurementValidationError("Conflicting partner-visible publication", 409);
    }
    if (!freshSameStatus && !(PARTNER_VISIBLE_STATUS_NEXT[fresh.partnerVisibleStatus] ?? []).includes(requested)) throw new VehicleFinanceProcurementValidationError("Invalid partner-visible status transition", 409);
    const caseData = (caseSnapshot.data() ?? {}) as Record<string, unknown>;
    const priorOrder = Number.isSafeInteger(caseData.partnerPublicationSequence) && Number(caseData.partnerPublicationSequence) >= 0 ? Number(caseData.partnerPublicationSequence) : 0;
    const partnerPublicationOrder = priorOrder + 1;
    const published = { ...fresh, partnerVisibleStatus: requested, partnerVisibleStatusUpdatedAt: now, partnerVisibleStatusUpdatedBy: actor.actorId ?? null, messageTemplateId: publicationMessage.messageTemplateId, renderedPartnerMessage: publicationMessage.renderedPartnerMessage, publishedAt: now, publishedBy: actor.actorId ?? null, partnerPublicationOrder, revisionRequestOpen: requested === "REVISION_REQUESTED" ? true : requested === "QUOTE_RECEIVED" ? false : fresh.revisionRequestOpen, partnerActivityHistory: [...fresh.partnerActivityHistory, { status: requested, timestamp: now, actorId: actor.actorId ?? null, actorName: actor.actorName ?? null, note: publicationMessage.renderedPartnerMessage }], updatedAt: now, updatedBy: actor.actorId ?? null };
    transaction.set(quoteRef, published, { merge: true });
    transaction.set(caseRef, { partnerPublicationSequence: partnerPublicationOrder }, { merge: true });
    return { publication: published, created: true };
  });
  if (next.created) await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_PARTNER_VISIBLE_STATUS_PUBLISHED", actor, targetId: supplierQuoteId, previousValue: { partnerVisibleStatus: current.partnerVisibleStatus }, newValue: { partnerVisibleStatus: requested, messageTemplateId: publicationMessage.messageTemplateId, renderedPartnerMessage: publicationMessage.renderedPartnerMessage }, metadata: { module: "vehicle-finance-procurement", supplierId: current.supplierId, procurementCaseId: current.procurementCaseId } });
  return next.publication;
}
type VehicleFinancePartnerContext = ActorContext & { supplierId: string };
type PartnerTimelineEntry = { id: string; status: string; timestamp: string; note: string };

type VehicleFinancePartnerPortalOverview = {
  supplier: Record<string, unknown>;
  procurementCases: Array<Record<string, unknown>>;
  supplierQuotes: Array<Record<string, unknown>>;
  timeline: PartnerTimelineEntry[];
};

function requirePartnerSupplierId(value: unknown): string {
  const supplierId = asString(value);
  if (!supplierId) throw new VehicleFinanceProcurementValidationError("Partner supplier link is required", 403);
  return supplierId;
}

async function assertActivePartnerSupplier(supplierId: string) {
  const supplierSnapshot = await assertProcurementDocument(SUPPLIER_COLLECTION, supplierId, "Supplier");
  const supplier = normalizeSupplierData(supplierSnapshot.id, (supplierSnapshot.data() ?? {}) as Record<string, unknown>);
  if (!supplier.active || supplier.archived || supplier.relationshipStatus === "ARCHIVED") {
    throw new VehicleFinanceProcurementValidationError("Supplier is not active for partner portal access", 403);
  }
  return supplier;
}

function sanitizePartnerSupplier(supplier: import("@/types/vehicleFinance").VehicleFinanceSupplier): Record<string, unknown> {
  return {
    supplierId: supplier.supplierId,
    legalName: supplier.legalName,
    tradingName: supplier.tradingName,
    supplierCategory: supplier.supplierCategory,
    classification: supplier.classification,
    brandsRepresented: supplier.brandsRepresented,
    branchLocation: supplier.branchLocation,
    primarySalesContact: supplier.primarySalesContact,
    fleetContact: supplier.fleetContact,
    email: supplier.email,
    phone: supplier.phone,
    relationshipStatus: supplier.relationshipStatus,
    preferredSupplier: supplier.preferredSupplier,
    geographicCoverage: supplier.geographicCoverage,
    active: supplier.active,
    operatingDivision: supplier.operatingDivision,
  };
}

function sanitizePartnerQuote(quote: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote): Record<string, unknown> {
  return {
    supplierQuoteId: quote.supplierQuoteId,
    supplierId: quote.supplierId,
    procurementCaseId: quote.procurementCaseId,
    vehicleDescription: quote.vehicleDescription,
    quotedAmount: quote.quotedAmount,
    availability: quote.availability,
    quoteDate: quote.quoteDate,
    quoteExpiry: quote.quoteExpiry,
    supplierReference: quote.supplierReference,
    colourSpecification: quote.colourSpecification,
    quoteState: quote.quoteState,
    partnerVisibleStatus: quote.partnerVisibleStatus,
    partnerVisibleStatusUpdatedAt: quote.partnerVisibleStatusUpdatedAt,
    messageTemplateId: quote.messageTemplateId,
    renderedPartnerMessage: quote.renderedPartnerMessage,
    publishedAt: quote.publishedAt,
    stockAvailability: quote.stockAvailability,
    expectedDeliveryDate: quote.expectedDeliveryDate,
    colourSpecificationConfirmed: quote.colourSpecificationConfirmed,
    partnerNotes: quote.partnerNotes,
    revisionRequestOpen: quote.revisionRequestOpen,
    supportingDocuments: quote.supportingDocuments,
    updatedAt: quote.updatedAt,
  };
}

function hasCompletePartnerPublication(quote: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote): boolean {
  return Boolean(
    quote.partnerVisibleStatus &&
    quote.messageTemplateId &&
    quote.renderedPartnerMessage &&
    quote.publishedAt &&
    quote.publishedBy &&
    quote.partnerVisibleStatusUpdatedAt &&
    quote.partnerVisibleStatusUpdatedBy &&
    Number.isSafeInteger(quote.partnerPublicationOrder) &&
    (quote.partnerPublicationOrder ?? 0) > 0,
  );
}

function latestPartnerPublication(caseQuotes: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote[]) {
  return caseQuotes
    .filter(hasCompletePartnerPublication)
    .sort((left, right) => {
      const timestampOrder = (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
      return timestampOrder || (right.partnerPublicationOrder ?? 0) - (left.partnerPublicationOrder ?? 0);
    })[0] ?? null;
}

function sanitizePartnerCase(procurementCase: import("@/types/vehicleFinance").VehicleFinanceProcurementCase, caseQuotes: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote[]): Record<string, unknown> {
  const publication = latestPartnerPublication(caseQuotes);
  return {
    procurementCaseId: procurementCase.procurementCaseId,
    internalReference: procurementCase.internalReference,
    vehicleQuantity: procurementCase.vehicleQuantity,
    make: procurementCase.make,
    model: procurementCase.model,
    variant: procurementCase.variant,
    fuelType: procurementCase.fuelType,
    colour: procurementCase.colour,
    requiredSpecifications: procurementCase.requiredSpecifications,
    condition: procurementCase.condition,
    purchaseMethod: procurementCase.purchaseMethod,
    requiredDeliveryDate: procurementCase.requiredDeliveryDate,
    partnerVisibleStatus: publication?.partnerVisibleStatus ?? null,
    renderedPartnerMessage: publication?.renderedPartnerMessage ?? null,
    quoteIds: caseQuotes.map((quote) => quote.supplierQuoteId),
    updatedAt: procurementCase.updatedAt,
  };
}

function buildPartnerTimeline(quotes: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote[]): PartnerTimelineEntry[] {
  return quotes.flatMap((quote) => quote.partnerActivityHistory.map((entry, index) => ({
    id: quote.supplierQuoteId + ":" + index,
    status: entry.status,
    timestamp: entry.timestamp,
    note: entry.note,
  }))).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function getVehicleFinancePartnerPortalOverview(context: VehicleFinancePartnerContext): Promise<VehicleFinancePartnerPortalOverview> {
  const supplierId = requirePartnerSupplierId(context.supplierId);
  const supplier = await assertActivePartnerSupplier(supplierId);
  const quoteSnapshot = await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).where("supplierId", "==", supplierId).limit(500).get();
  const quotes = quoteSnapshot.docs.map((doc) => normalizeSupplierQuoteData(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  const caseIds = Array.from(new Set(quotes.map((quote) => quote.procurementCaseId).filter(Boolean)));
  const cases = (await Promise.all(caseIds.map(async (caseId) => {
    const snapshot = await getFirebaseAdmin().collection(PROCUREMENT_CASE_COLLECTION).doc(caseId).get();
    return snapshot.exists ? normalizeProcurementCaseData(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>) : null;
  }))).filter((item): item is import("@/types/vehicleFinance").VehicleFinanceProcurementCase => Boolean(item));

  return {
    supplier: sanitizePartnerSupplier(supplier),
    procurementCases: cases.map((item) => sanitizePartnerCase(item, quotes.filter((quote) => quote.procurementCaseId === item.procurementCaseId))),
    supplierQuotes: quotes.map(sanitizePartnerQuote),
    timeline: buildPartnerTimeline(quotes),
  };
}

export async function updateVehicleFinancePartnerQuoteAction(supplierQuoteId: string, input: Record<string, unknown>, context: VehicleFinancePartnerContext): Promise<Record<string, unknown>> {
  const supplierId = requirePartnerSupplierId(context.supplierId);
  await assertActivePartnerSupplier(supplierId);
  const quoteSnapshot = await assertProcurementDocument(SUPPLIER_QUOTE_COLLECTION, supplierQuoteId, "Supplier quote");
  const current = normalizeSupplierQuoteData(quoteSnapshot.id, (quoteSnapshot.data() ?? {}) as Record<string, unknown>);
  if (current.supplierId !== supplierId) throw new VehicleFinanceProcurementValidationError("Supplier quote not found", 404);
  await assertProcurementDocument(PROCUREMENT_CASE_COLLECTION, current.procurementCaseId, "Procurement case");

  const action = procurementEnum(input.action, ["REVISE_QUOTE", "UPDATE_AVAILABILITY", "RESPOND_REVISION", "UPLOAD_DOCUMENT"], "UPDATE_AVAILABILITY", "partner action");
  const now = new Date().toISOString();
  const next: import("@/types/vehicleFinance").VehicleFinanceSupplierQuote = { ...current, updatedAt: now, updatedBy: context.actorId ?? null };
  const activityNote = asString(input.note) || (action === "REVISE_QUOTE" ? "Revised quotation uploaded" : action === "UPLOAD_DOCUMENT" ? "Supporting document uploaded" : action === "RESPOND_REVISION" ? "Revision request response submitted" : "Supplier availability updated");

  if (action === "REVISE_QUOTE") {
    const amount = input.quotedAmount === undefined ? next.quotedAmount : procurementNumber(input.quotedAmount);
    if (amount <= 0) throw new VehicleFinanceProcurementValidationError("Quoted amount must be greater than zero");
    next.quotedAmount = amount;
    next.vehicleDescription = asString(input.vehicleDescription) || next.vehicleDescription;
    next.availability = asString(input.availability) || next.availability;
    next.revisionRequestOpen = false;
  }

  if (action === "UPDATE_AVAILABILITY" || action === "REVISE_QUOTE" || action === "RESPOND_REVISION") {
    next.stockAvailability = asString(input.stockAvailability) || asString(input.availability) || next.stockAvailability || next.availability;
    next.expectedDeliveryDate = asString(input.expectedDeliveryDate) || next.expectedDeliveryDate || null;
    next.colourSpecification = asString(input.colourSpecification) || next.colourSpecification || null;
    next.colourSpecificationConfirmed = input.colourSpecificationConfirmed === true || next.colourSpecificationConfirmed === true;
    next.supplierReference = asString(input.supplierReference) || next.supplierReference || null;
    next.partnerNotes = asString(input.partnerNotes) || asString(input.note) || next.partnerNotes || null;
  }

  if (action === "UPLOAD_DOCUMENT" || input.document) {
    const documents = normalizeSupplierQuoteDocuments([input.document]);
    if (!documents.length) throw new VehicleFinanceProcurementValidationError("Supporting document metadata is required");
    next.supportingDocuments = [...next.supportingDocuments, ...documents.map((document) => ({ ...document, uploadedAt: now, uploadedBy: context.actorId ?? null }))];
  }

  next.partnerActivityHistory = [...next.partnerActivityHistory, { status: next.partnerVisibleStatus, timestamp: now, actorId: context.actorId ?? null, actorName: context.actorName ?? null, note: activityNote }];
  await getFirebaseAdmin().collection(SUPPLIER_QUOTE_COLLECTION).doc(supplierQuoteId).set(next, { merge: true });
  await safeRecordAuditEvent({ eventType: "VEHICLE_FINANCE_PARTNER_QUOTE_ACTION", actor: context, targetId: supplierQuoteId, previousValue: { partnerVisibleStatus: current.partnerVisibleStatus, quotedAmount: current.quotedAmount }, newValue: { partnerVisibleStatus: next.partnerVisibleStatus, quotedAmount: next.quotedAmount }, metadata: { module: "vehicle-finance-partner-portal", supplierId, procurementCaseId: current.procurementCaseId, action } });
  return sanitizePartnerQuote(next);
}
