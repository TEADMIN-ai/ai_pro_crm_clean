import {
  HYGIENE_PHOTO_CATEGORIES,
  type HygieneBinAsset,
  type HygieneClient,
  type HygieneCollection,
  type HygieneComplianceDocument,
  type HygieneDriverLog,
  type HygieneEvidencePhoto,
  type HygieneManifest,
  type HygienePhotoCategory,
  type HygieneReport,
  type HygieneSite,
  type HygieneVehicleInspection,
} from "@/types/hygiene";

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid hygiene payload: expected an object.");
  }

  return input as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid hygiene payload: ${field} is required.`);
  }

  return value.trim();
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

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid hygiene payload: ${field} must be a number.`);
  }

  return value;
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

function requireStringArray(record: Record<string, unknown>, field: string): string[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid hygiene payload: ${field} must be an array.`);
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function validateWorkflowSteps(record: Record<string, unknown>): HygieneCollection["workflowSteps"] {
  const value = record.workflowSteps;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const step = asRecord(item);
    return {
      stepId: requireString(step, "stepId"),
      label: requireString(step, "label"),
      status: requireString(step, "status") as HygieneCollection["workflowSteps"][number]["status"],
    };
  });
}

export function validateHygieneClient(input: unknown): HygieneClient {
  const record = asRecord(input);
  return {
    clientId: requireString(record, "clientId"),
    clientName: requireString(record, "clientName"),
    clientType: requireString(record, "clientType"),
    companyRegistration: requireString(record, "companyRegistration"),
    primaryContactName: requireString(record, "primaryContactName"),
    primaryContactPhone: requireString(record, "primaryContactPhone"),
    primaryContactEmail: requireString(record, "primaryContactEmail"),
    billingContact: requireString(record, "billingContact"),
    contractStartDate: requireDateString(record, "contractStartDate"),
    contractEndDate: requireDateString(record, "contractEndDate"),
    serviceFrequency: requireString(record, "serviceFrequency"),
    collectionDay: requireString(record, "collectionDay"),
    collectionWindow: requireString(record, "collectionWindow"),
    paymentStatus: requireString(record, "paymentStatus") as HygieneClient["paymentStatus"],
    status: requireString(record, "status") as HygieneClient["status"],
    monthlyRevenue: requireNumber(record, "monthlyRevenue"),
    createdAt: requireString(record, "createdAt"),
    updatedAt: requireString(record, "updatedAt"),
  };
}

export function validateHygieneSite(input: unknown): HygieneSite {
  const record = asRecord(input);
  return {
    siteId: requireString(record, "siteId"),
    clientId: requireString(record, "clientId"),
    siteName: requireString(record, "siteName"),
    address: requireString(record, "address"),
    suburb: requireString(record, "suburb"),
    city: requireString(record, "city"),
    contactPerson: requireString(record, "contactPerson"),
    contactPhone: requireString(record, "contactPhone"),
    binCount: requireNumber(record, "binCount"),
    binSize: requireString(record, "binSize"),
    serviceFrequency: requireString(record, "serviceFrequency"),
    accessNotes: requireString(record, "accessNotes"),
    lastServiceDate: optionalString(record, "lastServiceDate"),
    nextServiceDate: optionalString(record, "nextServiceDate"),
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
    binType: requireString(record, "binType"),
    locationDescription: requireString(record, "locationDescription"),
    status: requireString(record, "status") as HygieneBinAsset["status"],
    installDate: requireDateString(record, "installDate"),
    lastServiceDate: optionalString(record, "lastServiceDate"),
    nextServiceDate: optionalString(record, "nextServiceDate"),
    condition: requireString(record, "condition"),
    notes: requireString(record, "notes"),
  };
}

export function validateHygieneCollection(input: unknown): HygieneCollection {
  const record = asRecord(input);
  return {
    collectionId: requireString(record, "collectionId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    scheduledDate: requireDateString(record, "scheduledDate"),
    scheduledTimeWindow: requireString(record, "scheduledTimeWindow"),
    assignedDriver: requireString(record, "assignedDriver"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    vehicleName: requireString(record, "vehicleName"),
    status: requireString(record, "status") as HygieneCollection["status"],
    arrivalTime: optionalString(record, "arrivalTime"),
    departureTime: optionalString(record, "departureTime"),
    completedAt: optionalString(record, "completedAt"),
    manifestId: requireString(record, "manifestId"),
    evidencePhotoIds: requireStringArray(record, "evidencePhotoIds"),
    clientSignatureStatus: requireString(record, "clientSignatureStatus"),
    notes: requireString(record, "notes"),
    workflowSteps: validateWorkflowSteps(record),
  };
}

export function validateHygieneManifest(input: unknown): HygieneManifest {
  const record = asRecord(input);
  return {
    manifestId: requireString(record, "manifestId"),
    collectionId: requireString(record, "collectionId"),
    clientId: requireString(record, "clientId"),
    siteId: requireString(record, "siteId"),
    generatorRegistration: requireString(record, "generatorRegistration"),
    transportRegistration: requireString(record, "transportRegistration"),
    wasteClassification: requireString(record, "wasteClassification") as HygieneManifest["wasteClassification"],
    wasteType: requireString(record, "wasteType"),
    quantity: requireNumber(record, "quantity"),
    unit: requireString(record, "unit"),
    collectionDate: requireDateString(record, "collectionDate"),
    collectedBy: requireString(record, "collectedBy"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    disposalFacility: requireString(record, "disposalFacility"),
    disposalDate: optionalString(record, "disposalDate"),
    disposalCertificateNo: requireString(record, "disposalCertificateNo"),
    status: requireString(record, "status") as HygieneManifest["status"],
    createdAt: requireString(record, "createdAt"),
    updatedAt: requireString(record, "updatedAt"),
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
    uploadedBy: requireString(record, "uploadedBy"),
    uploadedAt: requireString(record, "uploadedAt"),
    fileUrl: requireString(record, "fileUrl"),
    timestampFromImage: optionalString(record, "timestampFromImage"),
    notes: requireString(record, "notes"),
  };
}

export function validateHygieneVehicleInspection(input: unknown): HygieneVehicleInspection {
  const record = asRecord(input);
  return {
    inspectionId: requireString(record, "inspectionId"),
    date: requireDateString(record, "date"),
    vehicleRegistration: requireString(record, "vehicleRegistration"),
    vehicleName: requireString(record, "vehicleName"),
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
    linkedCollectionIds: requireStringArray(record, "linkedCollectionIds"),
  };
}

export function validateHygieneComplianceDocument(input: unknown): HygieneComplianceDocument {
  const record = asRecord(input);
  return {
    documentId: requireString(record, "documentId"),
    documentType: requireString(record, "documentType"),
    title: requireString(record, "title"),
    registrationNumber: requireString(record, "registrationNumber"),
    issueDate: optionalString(record, "issueDate"),
    expiryDate: optionalString(record, "expiryDate"),
    status: requireString(record, "status") as HygieneComplianceDocument["status"],
    fileUrl: optionalString(record, "fileUrl"),
    owner: requireString(record, "owner"),
    uploadedAt: optionalString(record, "uploadedAt"),
  };
}

export function validateHygieneReport(input: unknown): HygieneReport {
  const record = asRecord(input);
  return {
    reportId: requireString(record, "reportId"),
    period: requireString(record, "period"),
    collectionsCompleted: requireNumber(record, "collectionsCompleted"),
    sitesServiced: requireNumber(record, "sitesServiced"),
    totalBinsServiced: requireNumber(record, "totalBinsServiced"),
    manifestsCreated: requireNumber(record, "manifestsCreated"),
    disposalCertificatesPending: requireNumber(record, "disposalCertificatesPending"),
    incidents: requireNumber(record, "incidents"),
    evidenceCompletionPercentage: requireNumber(record, "evidenceCompletionPercentage"),
    revenueSummary: requireNumber(record, "revenueSummary"),
    createdAt: requireString(record, "createdAt"),
  };
}
