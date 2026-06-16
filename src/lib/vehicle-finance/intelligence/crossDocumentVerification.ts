import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type {
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
} from "@/types/vehicleFinance";
import { compareVehicleFinanceDriverLicenceToIdentityDocument } from "../verification/crossDocumentVerification";

const DOCUMENT_COLLECTION = "vehicleFinanceDocuments";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    documentType: asString(data.documentType) as VehicleFinanceDocument["documentType"],
    filePath: asString(data.filePath),
    fileName: asString(data.fileName),
    extractedText: asString(data.extractedText),
    aiAnalysis: (data.aiAnalysis as VehicleFinanceDocumentAnalysis | Record<string, unknown>) ?? {},
    uploadedAt: toIso(data.uploadedAt),
    directTextLength: typeof data.directTextLength === "number" ? data.directTextLength : 0,
    ocrTextLength: typeof data.ocrTextLength === "number" ? data.ocrTextLength : 0,
    extractedTextLength: typeof data.extractedTextLength === "number" ? data.extractedTextLength : 0,
    pageCount: typeof data.pageCount === "number" ? data.pageCount : 0,
    extractionSource: (asString(data.extractionSource) || "EMPTY") as VehicleFinanceDocument["extractionSource"],
  };
}

function getDriverLicenceIntelligence(document: VehicleFinanceDocument): VehicleFinanceDriverLicenceIntelligence | null {
  return (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.driverLicenceIntelligence ?? null;
}

function getIdentityIntelligence(document: VehicleFinanceDocument): VehicleFinanceIdentityDocumentIntelligence | null {
  return (document.aiAnalysis as Partial<VehicleFinanceDocumentAnalysis>)?.identityIntelligence ?? null;
}

async function updateDocumentIntelligence(
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

export async function syncVehicleFinanceCrossDocumentVerification(applicationId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection(DOCUMENT_COLLECTION)
    .where("applicationId", "==", applicationId)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const documents = snapshot.docs
    .map((doc) => normalizeDocumentData(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

  const driverDocument = documents.find(
    (document) => document.documentType === "driversLicense" && Boolean(getDriverLicenceIntelligence(document)),
  );
  const identityDocument = documents.find(
    (document) =>
      (document.documentType === "greenIdBook" || document.documentType === "smartIdCard") &&
      Boolean(getIdentityIntelligence(document)),
  );

  const driverLicenceIntelligence = driverDocument ? getDriverLicenceIntelligence(driverDocument) : null;
  const identityIntelligence = identityDocument ? getIdentityIntelligence(identityDocument) : null;

  const verification = compareVehicleFinanceDriverLicenceToIdentityDocument(driverLicenceIntelligence, identityIntelligence);
  if (!verification || !driverDocument || !identityDocument) {
    return null;
  }

  const updatedDriverAnalysis: VehicleFinanceDocumentAnalysis = {
    ...(driverDocument.aiAnalysis as VehicleFinanceDocumentAnalysis),
    driverLicenceIntelligence: {
      ...(driverLicenceIntelligence as VehicleFinanceDriverLicenceIntelligence),
      crossDocumentVerification: verification,
    },
  };

  const updatedIdentityAnalysis: VehicleFinanceDocumentAnalysis = {
    ...(identityDocument.aiAnalysis as VehicleFinanceDocumentAnalysis),
    identityIntelligence: {
      ...(identityIntelligence as VehicleFinanceIdentityDocumentIntelligence),
      crossDocumentVerification: verification,
    },
  };

  await Promise.all([
    updateDocumentIntelligence(driverDocument.documentId, {
      aiAnalysis: updatedDriverAnalysis,
    }),
    updateDocumentIntelligence(identityDocument.documentId, {
      aiAnalysis: updatedIdentityAnalysis,
    }),
  ]);

  console.log("[CROSS_DOCUMENT_VERIFICATION_COMPLETE]", {
    applicationId,
    driverDocumentId: driverDocument.documentId,
    identityDocumentId: identityDocument.documentId,
    verification,
  });

  return verification;
}
