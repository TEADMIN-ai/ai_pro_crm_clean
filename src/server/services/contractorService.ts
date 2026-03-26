import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { ContractorDocument } from "@/types/document";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function hasTimestamp(value: unknown): boolean {
  return typeof toMillis(value) === "number";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function listContractors() {
  const snapshot = await getFirebaseAdmin().collection("contractors").get();
  const contractors: Array<Record<string, unknown> & { id: string }> = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));

  return contractors.sort((a, b) => {
      const aCreatedAt = typeof a.createdAt === "number" ? a.createdAt : 0;
      const bCreatedAt = typeof b.createdAt === "number" ? b.createdAt : 0;
      return bCreatedAt - aCreatedAt;
    });
}

export async function createContractor(
  payload: Record<string, unknown>,
  actor?: Pick<AuthorizedUser, "uid" | "email" | "role">,
) {
  const createdAt = typeof payload.createdAt === "number" ? payload.createdAt : Date.now();
  const updatedAt = new Date(createdAt).toISOString();
  const companyName = asString(payload.companyName) ?? asString(payload.name) ?? "Unnamed Contractor";
  const companyRegistrationNumber =
    asString(payload.companyRegistrationNumber) ?? asString(payload.registrationNumber);
  const email = asString(payload.email) ?? asString(payload.contactEmail);
  const phone = asString(payload.phone) ?? asString(payload.contactPhone);
  const status = asString(payload.status) ?? "pending";
  const createdBy = actor?.uid ?? asString(payload.createdBy) ?? null;
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? { ...(payload.metadata as Record<string, unknown>) }
      : {};

  const docRef = getFirebaseAdmin().collection("contractors").doc();
  const contractorId = docRef.id;
  const auditTrailEntry = {
    id: `${contractorId}:created:${createdAt}`,
    type: "contractor_created",
    message: "Contractor created",
    performedByUid: createdBy,
    performedByEmail: actor?.email ?? null,
    performedByRole: actor?.role ?? null,
    createdAt: updatedAt,
  };

  await docRef.set({
    ...payload,
    id: contractorId,
    contractorId,
    companyName,
    name: asString(payload.name) ?? companyName,
    companyRegistrationNumber: companyRegistrationNumber ?? null,
    registrationNumber: companyRegistrationNumber ?? null,
    email: email ?? null,
    contactEmail: email ?? null,
    phone: phone ?? null,
    contactPhone: phone ?? null,
    status,
    createdAt,
    updatedAt,
    createdBy,
    createdByEmail: actor?.email ?? null,
    createdByRole: actor?.role ?? null,
    metadata: {
      createdVia: "contractorService.createContractor",
      ...metadata,
      lastUpdatedByUid: createdBy,
      lastUpdatedByEmail: actor?.email ?? null,
      lastUpdatedByRole: actor?.role ?? null,
      lastUpdatedAt: updatedAt,
    },
    auditTrail: Array.isArray(payload.auditTrail)
      ? [...payload.auditTrail, auditTrailEntry]
      : [auditTrailEntry],
  });

  return docRef.id;
}

export async function getContractorById(contractorId: string) {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function updateContractorById(contractorId: string, updates: Record<string, unknown>) {
  await getFirebaseAdmin().collection("contractors").doc(contractorId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteContractorById(contractorId: string) {
  await getFirebaseAdmin().collection("contractors").doc(contractorId).delete();
}

export async function listContractorDocuments(contractorId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  return snapshot.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const document: ContractorDocument = {
      aiData:
        data.aiData && typeof data.aiData === "object"
          ? (data.aiData as ContractorDocument["aiData"])
          : undefined,
      riskLevel:
        data.riskLevel === "low" ||
        data.riskLevel === "medium" ||
        data.riskLevel === "high" ||
        data.riskLevel === "unknown"
          ? data.riskLevel
          : undefined,
      aiIssues: Array.isArray(data.aiIssues)
        ? data.aiIssues.filter((value): value is string => typeof value === "string")
        : undefined,
      aiAnalysis:
        data.aiAnalysis && typeof data.aiAnalysis === "object"
          ? (data.aiAnalysis as ContractorDocument["aiAnalysis"])
          : undefined,
      id: doc.id,
      contractorId: asString(data.contractorId) ?? contractorId,
      documentName: asString(data.documentName) ?? asString(data.fileName),
      documentType: asString(data.documentType) ?? asString(data.docType),
      docType: asString(data.docType),
      fileName: asString(data.fileName),
      originalName: asString(data.originalName),
      filename: asString(data.filename),
      storagePath: asString(data.storagePath),
      fileUrl: asString(data.fileUrl) ?? asString(data.downloadURL) ?? asString(data.url),
      downloadURL: asString(data.downloadURL) ?? asString(data.fileUrl),
      verified: data.verified === true || hasTimestamp(data.verifiedAt),
      verifiedAt: toMillis(data.verifiedAt),
      verifiedBy: asString(data.verifiedBy),
      validationStatus:
        data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL"
          ? data.validationStatus
          : undefined,
      validationError: asString(data.validationError),
      reviewReason: asString(data.reviewReason),
      reviewedBy: asString(data.reviewedBy),
      reviewedAt: toMillis(data.reviewedAt),
      manualDecisionAvailable: data.manualDecisionAvailable === true,
      confidenceNotes: Array.isArray(data.confidenceNotes)
        ? data.confidenceNotes.filter((value): value is string => typeof value === "string")
        : undefined,
      suggestions: Array.isArray(data.suggestions)
        ? data.suggestions.filter((value): value is string => typeof value === "string")
        : data.aiAnalysis &&
            typeof data.aiAnalysis === "object" &&
            Array.isArray((data.aiAnalysis as { suggestions?: unknown[] }).suggestions)
          ? (data.aiAnalysis as { suggestions: unknown[] }).suggestions.filter(
              (value): value is string => typeof value === "string"
            )
        : undefined,
      uploadedAt: toMillis(data.uploadedAt),
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      extractedAt: toMillis(data.extractedAt),
      expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : undefined,
      expiryDate: typeof data.expiryDate === "number" ? data.expiryDate : undefined,
      isExpired: data.isExpired === true,
      confidenceScore: typeof data.confidenceScore === "number" ? data.confidenceScore : undefined,
      extractedFields:
        data.extractedFields && typeof data.extractedFields === "object"
          ? (data.extractedFields as Record<string, string | null>)
          : undefined,
      missingFields: Array.isArray(data.missingFields)
        ? data.missingFields.filter((value): value is string => typeof value === "string")
        : undefined,
      issues: Array.isArray(data.issues)
        ? data.issues.filter((value): value is string => typeof value === "string")
        : undefined,
      validationErrors: Array.isArray(data.validationErrors)
        ? data.validationErrors.filter((value): value is string => typeof value === "string")
        : undefined,
      analysisTimestamp: toMillis(data.analysisTimestamp),
      extractionMethod:
        data.extractionMethod === "pdf-parse" || data.extractionMethod === "ocr"
          ? data.extractionMethod
          : undefined,
      extractedText: asString(data.extractedText),
      extractedTextLength:
        typeof data.extractedTextLength === "number" ? data.extractedTextLength : undefined,
      status: asString(data.status),
    };

    return document;
  });
}

export async function upsertContractorDocument(
  contractorId: string,
  documentType: string,
  payload: Record<string, unknown>,
) {
  await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType)
    .set(payload, { merge: true });
}

export async function getContractorDocument(contractorId: string, documentType: string) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType)
    .get();

  return snapshot;
}
