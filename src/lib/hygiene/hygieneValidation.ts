import {
  HYGIENE_PHOTO_CATEGORIES,
  type HygieneBinAsset,
  type HygieneClient,
  type HygieneCollectionJob,
  type HygieneComplianceDocument,
  type HygieneDriverLog,
  type HygieneEvidencePhoto,
  type HygieneManifestStatus,
  type HygienePhotoCategory,
  type HygieneSite,
  type HygieneVehicleInspection,
  type HygieneWasteManifest,
} from "@/types/hygiene";

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid hygiene payload: ${field} is required.`);
  }

  return value.trim();
}

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid hygiene payload: ${field} must be a number.`);
  }

  return value;
}

function optionalString(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid hygiene payload: ${field} must be a string.`);
  }

  return value.trim();
}

function optionalNumber(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid hygiene payload: ${field} must be a number.`);
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid hygiene payload: ${field} must be true or false.`);
  }

  return value;
}

function requireDateString(record: Record<string, unknown>, field: string): string {
  const value = requireString(record, field);
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    throw new Error(`Invalid hygiene payload: ${field} must use YYYY-MM-DD format.`);
  }

  return value;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid hygiene payload: expected an object.");
  }

  return input as Record<string, unknown>;
}

export function validateHygieneClient(input: unknown): HygieneClient {
  const record = asRecord(input);
  return {
    clientId: requireString(record, "clientId"),
    clientName: requireString(record, "clientName"),
    companyRegistration: requireString(record, "companyRegistration"),
    contactPerson: requireString(record, "contactPerson"),
    phone: requireString(record, "phone"),
    email: requireString(record, "email"),
    contractStartDate: requireDateString(record, "contractStartDate"),
    contractEndDate: requireDateString(record, "contractEndDate"),
    serviceFrequency: requireString(record, "serviceFrequency"),
    collectionDay: requireString(record, "collectionDay"),
    collectionWindow: requireString(record, "collectionWindow"),
    paymentStatus: requireString(record, "paymentStatus") as HygieneClient["paymentStatus"],
    status: requireString(record, "status") as HygieneClient["status"],
    monthlyRevenue: requireNumber(record, "monthlyRevenue"),
  };
}

export function validateHygieneSite(input: unknown): HygieneSite {
  const record = asRecord(input);
  return {
    siteId: requireString(record, "siteId"),
    clientId: requireString(record, "clientId"),
    siteName: requireString(record, "siteName"),
    address: requireString(record, "address"),
    binCount: requireNumber(record, "binCount"),
    binSize: requireString(record, "binSize"),
    status: requireString(record, "status") as HygieneSite["status"],
  };
}

export function validateHygieneBinAsset(input: unknown): HygieneBinAsset {
  const record = asRecord(input);
  return {
    assetId: requireString(record, "assetId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    binSize: requireString(record, "binSize"),
    status: requireString(record, "status") as HygieneBinAsset["status"],
    installDate: requireDateString(record, "installDate"),
    lastServiceDate: requireDateString(record, "lastServiceDate"),
    nextServiceDate: requireDateString(record, "nextServiceDate"),
    condition: requireString(record, "condition"),
  };
}

export function validateHygieneCollection(input: unknown): HygieneCollectionJob {
  const record = asRecord(input);
  const evidencePhotoIds = record.evidencePhotoIds;
  return {
    collectionId: requireString(record, "collectionId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    scheduledDate: requireDateString(record, "scheduledDate"),
    scheduledTimeWindow: requireString(record, "scheduledTimeWindow"),
    assignedDriver: requireString(record, "assignedDriver"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    status: requireString(record, "status") as HygieneCollectionJob["status"],
    completedAt: optionalString(record, "completedAt"),
    evidencePhotoIds: Array.isArray(evidencePhotoIds) ? evidencePhotoIds.filter((item): item is string => typeof item === "string") : [],
    manifestId: requireString(record, "manifestId"),
  };
}

export function validateHygieneManifest(input: unknown): HygieneWasteManifest {
  const record = asRecord(input);
  return {
    manifestId: requireString(record, "manifestId"),
    collectionId: requireString(record, "collectionId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    generatorRegistration: requireString(record, "generatorRegistration"),
    transportRegistration: requireString(record, "transportRegistration"),
    wasteClassification: requireString(record, "wasteClassification") as HygieneWasteManifest["wasteClassification"],
    wasteType: requireString(record, "wasteType"),
    quantity: requireNumber(record, "quantity"),
    unit: requireString(record, "unit"),
    collectionDate: requireDateString(record, "collectionDate"),
    disposalFacility: requireString(record, "disposalFacility"),
    disposalDate: optionalString(record, "disposalDate"),
    disposalCertificateNo: requireString(record, "disposalCertificateNo"),
    status: requireString(record, "status") as HygieneManifestStatus,
  };
}

export function validateHygieneEvidencePhoto(input: unknown): HygieneEvidencePhoto {
  const record = asRecord(input);
  const category = requireString(record, "category");
  if (!HYGIENE_PHOTO_CATEGORIES.includes(category as HygienePhotoCategory)) {
    throw new Error("Invalid hygiene payload: category is not supported.");
  }

  return {
    photoId: requireString(record, "photoId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    collectionId: requireString(record, "collectionId"),
    manifestId: requireString(record, "manifestId"),
    category: category as HygienePhotoCategory,
    fileName: requireString(record, "fileName"),
    contentType: requireString(record, "contentType"),
    storagePath: requireString(record, "storagePath"),
    downloadUrl: requireString(record, "downloadUrl"),
    uploadedAt: requireString(record, "uploadedAt"),
    uploadedByUid: requireString(record, "uploadedByUid"),
  };
}

export function validateHygieneVehicleInspection(input: unknown): HygieneVehicleInspection {
  const record = asRecord(input);
  return {
    inspectionId: requireString(record, "inspectionId"),
    date: requireDateString(record, "date"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    vehicle: requireString(record, "vehicle"),
    driver: requireString(record, "driver"),
    odometerStart: optionalNumber(record, "odometerStart"),
    odometerEnd: optionalNumber(record, "odometerEnd"),
    fuelStatus: requireString(record, "fuelStatus"),
    roadworthyStatus: requireString(record, "roadworthyStatus"),
    ppeAvailable: requireBoolean(record, "ppeAvailable"),
    spillKitAvailable: requireBoolean(record, "spillKitAvailable"),
    wasteContainerSecured: requireBoolean(record, "wasteContainerSecured"),
    comments: requireString(record, "comments"),
    status: requireString(record, "status") as HygieneVehicleInspection["status"],
  };
}

export function validateHygieneDriverLog(input: unknown): HygieneDriverLog {
  const record = asRecord(input);
  return {
    driverLogId: requireString(record, "driverLogId"),
    date: requireDateString(record, "date"),
    driverName: requireString(record, "driverName"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    startKm: optionalNumber(record, "startKm"),
    endKm: optionalNumber(record, "endKm"),
    fuel: requireString(record, "fuel"),
    signatureStatus: requireString(record, "signatureStatus"),
  };
}

export function validateHygieneComplianceDocument(input: unknown): HygieneComplianceDocument {
  const record = asRecord(input);
  return {
    documentId: requireString(record, "documentId"),
    title: requireString(record, "title"),
    referenceNo: requireString(record, "referenceNo"),
    status: requireString(record, "status") as HygieneComplianceDocument["status"],
    issueDate: optionalString(record, "issueDate"),
    expiryDate: optionalString(record, "expiryDate"),
    alert: optionalString(record, "alert"),
  };
}
