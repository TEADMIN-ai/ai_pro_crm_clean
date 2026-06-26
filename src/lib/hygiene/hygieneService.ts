import { FieldValue } from "firebase-admin/firestore";
import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  cbavoBinAssets,
  cbavoClient,
  cbavoCollections,
  cbavoComplianceDocuments,
  cbavoDriverLogs,
  cbavoManifests,
  cbavoReports,
  cbavoSites,
  cbavoVehicleInspections,
} from "@/lib/hygiene/hygieneSeed";
import {
  validateHygieneBinAsset,
  validateHygieneClient,
  validateHygieneCollection,
  validateHygieneComplianceDocument,
  validateHygieneDriverLog,
  validateHygieneEvidencePhoto,
  validateHygieneJobEvent,
  validateHygieneManifest,
  validateHygieneReport,
  validateHygieneSignature,
  validateHygieneSite,
  validateHygieneVehicleInspection,
} from "@/lib/hygiene/hygieneValidation";
import type {
  HygieneBinAsset,
  HygieneClient,
  HygieneCollection,
  HygieneComplianceDocument,
  HygieneDashboardData,
  HygieneDashboardKpis,
  HygieneDriverLog,
  HygieneEvidencePhoto,
  HygieneJobEvent,
  HygieneManifest,
  HygieneReport,
  HygieneSignature,
  HygieneSite,
  HygieneVehicleInspection,
  HygieneWorkflowStep,
} from "@/types/hygiene";

export const HYGIENE_COLLECTIONS = {
  clients: "hygieneClients",
  sites: "hygieneSites",
  assets: "hygieneBinAssets",
  collections: "hygieneCollections",
  manifests: "hygieneManifests",
  evidencePhotos: "hygieneEvidence",
  vehicleInspections: "hygieneVehicleInspections",
  driverLogs: "hygieneDriverLogs",
  complianceDocuments: "hygieneComplianceDocuments",
  reports: "hygieneReports",
  jobEvents: "hygieneJobEvents",
  signatures: "hygieneSignatures",
} as const;

type CollectionName = (typeof HYGIENE_COLLECTIONS)[keyof typeof HYGIENE_COLLECTIONS];

export function assertHygieneInternalAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff" && user.role !== "driver") {
    throw new AuthorizationError("Hygiene dashboard is restricted to internal Torque Empire users.", 403);
  }
}

export function assertHygieneAdminAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager") {
    throw new AuthorizationError("Only admin and manager users may manage hygiene master data.", 403);
  }
}

export function assertHygieneStaffMutationAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff" && user.role !== "driver") {
    throw new AuthorizationError("Only internal operations users may update hygiene collection records.", 403);
  }
}

function isHygieneManagerRole(user: AuthorizedUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

function normalizeAssignmentValue(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isCollectionAssignedToUser(collection: HygieneCollection, user: AuthorizedUser): boolean {
  if (isHygieneManagerRole(user)) {
    return true;
  }

  if (collection.assignedUserIds?.includes(user.uid)) {
    return true;
  }

  const emailKey = normalizeAssignmentValue(user.email);
  const driverKey = normalizeAssignmentValue(collection.assignedDriver);
  return Boolean(emailKey && driverKey && (emailKey.includes(driverKey) || driverKey.includes(emailKey)));
}

function assertCanAccessCollectionWorkflow(collection: HygieneCollection, user: AuthorizedUser): void {
  assertHygieneStaffMutationAccess(user);

  if (!isCollectionAssignedToUser(collection, user)) {
    throw new AuthorizationError("This hygiene collection is not assigned to the current user.", 403);
  }
}

async function listCollection<T>(collectionName: CollectionName): Promise<T[]> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

async function setValidatedRecord<T>(
  collectionName: CollectionName,
  documentId: string,
  payload: T
): Promise<void> {
  await getFirebaseAdmin()
    .collection(collectionName)
    .doc(documentId)
    .set(
      {
        ...payload,
        updatedAtServer: FieldValue.serverTimestamp(),
        createdAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function assertDocumentExists(collectionName: CollectionName, documentId: string, label: string): Promise<void> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).doc(documentId).get();
  if (!snapshot.exists) {
    throw new Error(`${label} does not exist: ${documentId}`);
  }
}

async function assertRecordGraph(input: {
  clientId: string;
  siteId?: string;
  collectionId?: string;
  manifestId?: string;
}): Promise<void> {
  await assertDocumentExists(HYGIENE_COLLECTIONS.clients, input.clientId, "Hygiene client");

  if (input.siteId) {
    const siteSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.sites).doc(input.siteId).get();
    if (!siteSnapshot.exists || siteSnapshot.data()?.clientId !== input.clientId) {
      throw new Error("Hygiene site is missing or does not belong to the selected client.");
    }
  }

  if (input.collectionId) {
    const collectionSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(input.collectionId).get();
    const collection = collectionSnapshot.data();
    if (!collectionSnapshot.exists || collection?.clientId !== input.clientId) {
      throw new Error("Hygiene collection is missing or does not belong to the selected client.");
    }

    if (input.siteId && collection?.siteId !== input.siteId) {
      throw new Error("Hygiene collection does not belong to the selected site.");
    }
  }

  if (input.manifestId && input.manifestId !== "Pending") {
    const manifestSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.manifests).doc(input.manifestId).get();
    const manifest = manifestSnapshot.data();
    if (!manifestSnapshot.exists || manifest?.clientId !== input.clientId) {
      throw new Error("Hygiene manifest is missing or does not belong to the selected client.");
    }
  }
}

function computeComplianceStatus(documents: HygieneComplianceDocument[]): HygieneDashboardKpis["complianceStatus"] {
  if (documents.some((document) => document.status === "Compliance Expired")) {
    return "Compliance Expired";
  }

  if (documents.some((document) => document.status === "Compliance Warning" || document.status === "Pending")) {
    return "Compliance Warning";
  }

  return "Compliance Green";
}

function isInMonth(dateValue: string | null, yearMonth: string): boolean {
  return Boolean(dateValue?.startsWith(yearMonth));
}

function computeKpis(data: Omit<HygieneDashboardData, "kpis">): HygieneDashboardKpis {
  const currentMonth = "2026-06";
  const collectionsDueThisWeek = data.collections.filter((collection) => collection.status === "Scheduled").length;
  const completedThisMonth = data.collections.filter((collection) => collection.status === "Completed" && isInMonth(collection.completedAt, currentMonth)).length;
  const disposalCertificatesPending = data.manifests.filter((manifest) => manifest.status === "Disposal Pending" || manifest.status === "Awaiting Disposal").length;

  return {
    activeHygieneClients: data.clients.filter((client) => client.status === "Active").length,
    activeSites: data.sites.filter((site) => site.status === "Active").length,
    activeBinAssets: data.assets.filter((asset) => asset.status === "Active").length,
    collectionsDueThisWeek,
    collectionsCompletedThisMonth: completedThisMonth,
    wasteServicesCompleted: data.manifests.reduce((total, manifest) => total + manifest.quantity, 0),
    disposalCertificatesPending,
    complianceStatus: computeComplianceStatus(data.complianceDocuments),
    monthlyContractRevenue: data.clients.reduce((total, client) => total + client.monthlyRevenue, 0),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function updateWorkflowStep(steps: HygieneWorkflowStep[], label: string): HygieneWorkflowStep[] {
  const normalized = label.toLowerCase();
  return steps.map((step) =>
    step.label.toLowerCase().includes(normalized) || normalized.includes(step.label.toLowerCase())
      ? { ...step, status: "Completed" }
      : step
  );
}

function withUpdatedAt<T extends { updatedAt?: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

async function updateCollectionPatch(collectionId: string, patch: Partial<HygieneCollection> & Record<string, unknown>): Promise<void> {
  await getFirebaseAdmin()
    .collection(HYGIENE_COLLECTIONS.collections)
    .doc(collectionId)
    .set({ ...patch, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
}

async function getCollectionUnsafe(collectionId: string): Promise<HygieneCollection> {
  const snapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(collectionId).get();
  if (!snapshot.exists) throw new Error(`Hygiene collection does not exist: ${collectionId}`);
  return validateHygieneCollection(snapshot.data());
}

export async function getHygieneDashboardData(user: AuthorizedUser): Promise<HygieneDashboardData> {
  assertHygieneInternalAccess(user);

  const [
    clients,
    sites,
    assets,
    collections,
    manifests,
    evidencePhotos,
    vehicleInspections,
    driverLogs,
    complianceDocuments,
    reports,
    jobEvents,
    signatures,
  ] = await Promise.all([
    listCollection<HygieneClient>(HYGIENE_COLLECTIONS.clients),
    listCollection<HygieneSite>(HYGIENE_COLLECTIONS.sites),
    listCollection<HygieneBinAsset>(HYGIENE_COLLECTIONS.assets),
    listCollection<HygieneCollection>(HYGIENE_COLLECTIONS.collections),
    listCollection<HygieneManifest>(HYGIENE_COLLECTIONS.manifests),
    listCollection<HygieneEvidencePhoto>(HYGIENE_COLLECTIONS.evidencePhotos),
    listCollection<HygieneVehicleInspection>(HYGIENE_COLLECTIONS.vehicleInspections),
    listCollection<HygieneDriverLog>(HYGIENE_COLLECTIONS.driverLogs),
    listCollection<HygieneComplianceDocument>(HYGIENE_COLLECTIONS.complianceDocuments),
    listCollection<HygieneReport>(HYGIENE_COLLECTIONS.reports),
    listCollection<HygieneJobEvent>(HYGIENE_COLLECTIONS.jobEvents),
    listCollection<HygieneSignature>(HYGIENE_COLLECTIONS.signatures),
  ]);

  const baseData = {
    clients,
    sites,
    assets,
    collections,
    manifests,
    evidencePhotos,
    vehicleInspections,
    driverLogs,
    complianceDocuments,
    reports,
    jobEvents,
    signatures,
  };

  return {
    kpis: computeKpis(baseData),
    ...baseData,
  };
}

export async function seedCbavoHygieneDataset(user: AuthorizedUser): Promise<{ seeded: boolean; records: number }> {
  assertHygieneAdminAccess(user);

  const clients = [validateHygieneClient(cbavoClient)];
  const sites = cbavoSites.map(validateHygieneSite);
  const assets = cbavoBinAssets.map(validateHygieneBinAsset);
  const collections = cbavoCollections.map(validateHygieneCollection);
  const manifests = cbavoManifests.map(validateHygieneManifest);
  const vehicleInspections = cbavoVehicleInspections.map(validateHygieneVehicleInspection);
  const driverLogs = cbavoDriverLogs.map(validateHygieneDriverLog);
  const complianceDocuments = cbavoComplianceDocuments.map(validateHygieneComplianceDocument);
  const reports = cbavoReports.map(validateHygieneReport);

  await Promise.all([
    ...clients.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.clients, record.clientId, record)),
    ...sites.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.sites, record.siteId, record)),
    ...assets.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.assets, record.assetId, record)),
    ...collections.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.collections, record.collectionId, record)),
    ...manifests.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.manifests, record.manifestId, record)),
    ...vehicleInspections.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.vehicleInspections, record.inspectionId, record)),
    ...driverLogs.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.driverLogs, record.driverLogId, record)),
    ...complianceDocuments.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.complianceDocuments, record.documentId, record)),
    ...reports.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.reports, record.reportId, record)),
  ]);

  return {
    seeded: true,
    records:
      clients.length +
      sites.length +
      assets.length +
      collections.length +
      manifests.length +
      vehicleInspections.length +
      driverLogs.length +
      complianceDocuments.length +
      reports.length,
  };
}

export async function createHygieneEvidencePhoto(
  user: AuthorizedUser,
  input: HygieneEvidencePhoto
): Promise<HygieneEvidencePhoto> {
  assertHygieneStaffMutationAccess(user);

  const record = validateHygieneEvidencePhoto(input);
  await assertRecordGraph({
    clientId: record.clientId,
    siteId: record.siteId,
    collectionId: record.collectionId,
    manifestId: record.manifestId,
  });

  await setValidatedRecord(HYGIENE_COLLECTIONS.evidencePhotos, record.photoId, record);

  const collectionRef = getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(record.collectionId);
  await collectionRef.set(
    {
      evidencePhotoIds: FieldValue.arrayUnion(record.photoId),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordHygieneJobEvent(user, {
    eventType: record.category === "Disposal Certificate" ? "disposal_certificate_uploaded" : "evidence_uploaded",
    clientId: record.clientId,
    siteId: record.siteId,
    collectionId: record.collectionId,
    manifestId: record.manifestId === "Pending" ? null : record.manifestId,
    notes: `${record.category} uploaded.`,
    metadata: {
      photoId: record.photoId,
      category: record.category,
      fileUrl: record.fileUrl,
    },
  });

  return record;
}

export async function getHygieneMobileJobs(user: AuthorizedUser): Promise<HygieneDashboardData> {
  const data = await getHygieneDashboardData(user);
  if (isHygieneManagerRole(user)) {
    return data;
  }

  const collections = data.collections.filter((collection) => isCollectionAssignedToUser(collection, user));
  const collectionIds = new Set(collections.map((collection) => collection.collectionId));
  const siteIds = new Set(collections.map((collection) => collection.siteId));
  const clientIds = new Set(collections.map((collection) => collection.clientId));
  const manifestIds = new Set(collections.map((collection) => collection.manifestId).filter((id) => id !== "Pending"));

  return {
    ...data,
    collections,
    clients: data.clients.filter((client) => clientIds.has(client.clientId)),
    sites: data.sites.filter((site) => siteIds.has(site.siteId)),
    assets: data.assets.filter((asset) => siteIds.has(asset.siteId)),
    manifests: data.manifests.filter((manifest) => manifestIds.has(manifest.manifestId) || collectionIds.has(manifest.collectionId)),
    evidencePhotos: data.evidencePhotos.filter((photo) => collectionIds.has(photo.collectionId)),
    jobEvents: data.jobEvents?.filter((event) => collectionIds.has(event.collectionId)),
    signatures: data.signatures?.filter((signature) => collectionIds.has(signature.collectionId)),
  };
}

async function getCollectionForWorkflow(collectionId: string, user: AuthorizedUser): Promise<HygieneCollection> {
  const snapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(collectionId).get();
  if (!snapshot.exists) {
    throw new Error(`Hygiene collection does not exist: ${collectionId}`);
  }

  const collection = validateHygieneCollection(snapshot.data());
  assertCanAccessCollectionWorkflow(collection, user);
  return collection;
}

export async function recordHygieneJobEvent(
  user: AuthorizedUser,
  input: Omit<HygieneJobEvent, "eventId" | "userId" | "userEmail" | "timestamp"> & { eventId?: string; timestamp?: string }
): Promise<HygieneJobEvent> {
  const collection = await getCollectionForWorkflow(input.collectionId, user);
  const event = validateHygieneJobEvent({
    ...input,
    clientId: collection.clientId,
    siteId: collection.siteId,
    manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
    eventId: input.eventId ?? `TE-HJE-${Date.now()}`,
    userId: user.uid,
    userEmail: user.email ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
  });

  await setValidatedRecord(HYGIENE_COLLECTIONS.jobEvents, event.eventId, event);

  const collectionPatch: Partial<HygieneCollection> & Record<string, unknown> = {
    updatedAtServer: FieldValue.serverTimestamp(),
  };

  if (event.eventType === "job_started") {
    collectionPatch.status = "In Progress";
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "Start collection");
  }

  if (event.eventType === "vehicle_inspection_completed") {
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "vehicle");
  }

  if (event.eventType === "backup_vehicle_assigned") {
    collectionPatch.backupVehicleUsed = Boolean(event.metadata.backupVehicleUsed);
    collectionPatch.backupDriverUsed = Boolean(event.metadata.backupDriverUsed);
    collectionPatch.backupVehicleRegistration = typeof event.metadata.vehicleRegistration === "string" ? event.metadata.vehicleRegistration : null;
    collectionPatch.backupDriverName = typeof event.metadata.driverName === "string" ? event.metadata.driverName : null;
    collectionPatch.substitutionReason = typeof event.metadata.reason === "string" ? event.metadata.reason : null;
    collectionPatch.substitutionApprovedBy = typeof event.metadata.approvedBy === "string" ? event.metadata.approvedBy : null;
    collectionPatch.substitutionTimestamp = event.timestamp;
  }

  if (event.eventType === "arrived_on_site") {
    collectionPatch.arrivalTime = event.timestamp;
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "arrival");
  }

  if (event.eventType === "evidence_uploaded") {
    const category = typeof event.metadata.category === "string" ? event.metadata.category : "";
    if (category.includes("Before")) collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "before");
    if (category.includes("Completion") || category.includes("After")) collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "completion");
  }

  if (event.eventType === "checklist_step_completed") {
    const step = typeof event.metadata.step === "string" ? event.metadata.step : "checklist";
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, step);
    if (typeof event.metadata.binCount === "number") {
      collectionPatch.binCountConfirmed = event.metadata.binCount;
      collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "bin count");
    }
  }

  if (event.eventType === "manifest_generated") {
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "manifest");
  }

  if (event.eventType === "signature_captured") {
    collectionPatch.clientSignatureStatus = "Signature captured";
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "signature");
  }

  if (event.eventType === "awaiting_disposal") {
    collectionPatch.status = "Awaiting Disposal";
    collectionPatch.workflowSteps = updateWorkflowStep(collection.workflowSteps, "Complete collection");
  }

  if (event.eventType === "job_completed") {
    collectionPatch.status = "Completed";
    collectionPatch.completedAt = event.timestamp;
    collectionPatch.departureTime = event.timestamp;
  }

  await getFirebaseAdmin()
    .collection(HYGIENE_COLLECTIONS.collections)
    .doc(event.collectionId)
    .set(collectionPatch, { merge: true });

  if (event.eventType === "awaiting_disposal" && event.manifestId) {
    await getFirebaseAdmin()
      .collection(HYGIENE_COLLECTIONS.manifests)
      .doc(event.manifestId)
      .set(
        {
          status: "Awaiting Disposal",
          updatedAt: event.timestamp,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  return event;
}

export async function createHygieneSignature(
  user: AuthorizedUser,
  input: Omit<HygieneSignature, "signatureId" | "capturedBy" | "capturedAt"> & { signatureId?: string; capturedAt?: string }
): Promise<HygieneSignature> {
  const collection = await getCollectionForWorkflow(input.collectionId, user);
  const signature = validateHygieneSignature({
    ...input,
    clientId: collection.clientId,
    siteId: collection.siteId,
    manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
    signatureId: input.signatureId ?? `TE-SIG-${Date.now()}`,
    capturedBy: user.email ?? user.uid,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  });

  await setValidatedRecord(HYGIENE_COLLECTIONS.signatures, signature.signatureId, signature);
  await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(signature.collectionId).set(
    {
      clientSignatureStatus: "Signature captured",
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordHygieneJobEvent(user, {
    eventType: "signature_captured",
    clientId: signature.clientId,
    siteId: signature.siteId,
    collectionId: signature.collectionId,
    manifestId: signature.manifestId,
    notes: `Signature captured for ${signature.representativeName}.`,
    metadata: {
      representativeName: signature.representativeName,
      representativePosition: signature.representativePosition,
      signatureId: signature.signatureId,
    },
  });

  return signature;
}

export async function upsertHygieneClient(user: AuthorizedUser, input: Partial<HygieneClient>): Promise<HygieneClient> {
  assertHygieneAdminAccess(user);
  const timestamp = nowIso();
  const record = validateHygieneClient({
    clientId: input.clientId || nextId("TE-CLI"),
    clientName: input.clientName || "New Hygiene Client",
    clientType: input.clientType || "Hygiene Client",
    companyRegistration: input.companyRegistration || "Pending",
    primaryContactName: input.primaryContactName || "Pending",
    primaryContactPhone: input.primaryContactPhone || "Pending",
    primaryContactEmail: input.primaryContactEmail || "pending@example.com",
    billingContact: input.billingContact || input.primaryContactName || "Pending",
    contractStartDate: input.contractStartDate || timestamp.slice(0, 10),
    contractEndDate: input.contractEndDate || timestamp.slice(0, 10),
    serviceFrequency: input.serviceFrequency || "Weekly",
    collectionDay: input.collectionDay || "Friday",
    collectionWindow: input.collectionWindow || "After 13:00",
    paymentStatus: input.paymentStatus || "Pending",
    status: input.status || "Active",
    monthlyRevenue: typeof input.monthlyRevenue === "number" ? input.monthlyRevenue : 2100,
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
  });
  await setValidatedRecord(HYGIENE_COLLECTIONS.clients, record.clientId, record);
  return record;
}

export async function upsertHygieneSite(user: AuthorizedUser, input: Partial<HygieneSite>): Promise<HygieneSite> {
  assertHygieneAdminAccess(user);
  const record = validateHygieneSite({
    siteId: input.siteId || nextId("TE-SIT"),
    clientId: input.clientId || "TE-CLI-0001",
    siteName: input.siteName || "New Site",
    address: input.address || "Address pending",
    suburb: input.suburb || "Roodepoort",
    city: input.city || "Roodepoort",
    contactPerson: input.contactPerson || "CBAVO Services",
    contactPhone: input.contactPhone || "Pending",
    binCount: typeof input.binCount === "number" ? input.binCount : 1,
    binSize: input.binSize || "12L",
    serviceFrequency: input.serviceFrequency || "Weekly",
    accessNotes: input.accessNotes || "Access notes pending.",
    lastServiceDate: input.lastServiceDate ?? null,
    nextServiceDate: input.nextServiceDate ?? null,
    status: input.status || "Active",
  });
  await assertRecordGraph({ clientId: record.clientId });
  await setValidatedRecord(HYGIENE_COLLECTIONS.sites, record.siteId, record);
  return record;
}

export async function upsertHygieneAsset(user: AuthorizedUser, input: Partial<HygieneBinAsset>): Promise<HygieneBinAsset> {
  assertHygieneAdminAccess(user);
  const record = validateHygieneBinAsset({
    assetId: input.assetId || nextId("TE-BIN"),
    clientId: input.clientId || "TE-CLI-0001",
    siteId: input.siteId || "TE-SIT-0001",
    binSize: input.binSize || "12L",
    binType: input.binType || "Sanitary hygiene bin",
    locationDescription: input.locationDescription || "Service point pending",
    status: input.status || "Active",
    installDate: input.installDate || nowIso().slice(0, 10),
    lastServiceDate: input.lastServiceDate ?? null,
    nextServiceDate: input.nextServiceDate ?? null,
    condition: input.condition || "Serviceable",
    notes: input.notes || "Operational asset update.",
  });
  await assertRecordGraph({ clientId: record.clientId, siteId: record.siteId });
  await setValidatedRecord(HYGIENE_COLLECTIONS.assets, record.assetId, record);
  return record;
}

export async function upsertHygieneCollection(user: AuthorizedUser, input: Partial<HygieneCollection>): Promise<HygieneCollection> {
  assertHygieneAdminAccess(user);
  const timestamp = nowIso();
  const record = validateHygieneCollection({
    collectionId: input.collectionId || nextId("TE-COL"),
    clientId: input.clientId || "TE-CLI-0001",
    siteId: input.siteId || "TE-SIT-0001",
    scheduledDate: input.scheduledDate || timestamp.slice(0, 10),
    scheduledTimeWindow: input.scheduledTimeWindow || "After 13:00",
    assignedDriver: input.assignedDriver || "Unassigned",
    assignedUserIds: input.assignedUserIds || [],
    vehicleRegistration: input.vehicleRegistration || "Unassigned",
    vehicleName: input.vehicleName || "Unassigned vehicle",
    status: input.status || "Scheduled",
    arrivalTime: input.arrivalTime ?? null,
    departureTime: input.departureTime ?? null,
    completedAt: input.completedAt ?? null,
    manifestId: input.manifestId || "Pending",
    evidencePhotoIds: input.evidencePhotoIds || [],
    clientSignatureStatus: input.clientSignatureStatus || "Pending",
    notes: input.notes || "Operational collection update.",
    workflowSteps: input.workflowSteps || [],
    backupVehicleUsed: input.backupVehicleUsed,
    backupDriverUsed: input.backupDriverUsed,
    backupVehicleRegistration: input.backupVehicleRegistration,
    backupDriverName: input.backupDriverName,
    substitutionReason: input.substitutionReason,
    substitutionApprovedBy: input.substitutionApprovedBy,
    substitutionTimestamp: input.substitutionTimestamp,
    binCountConfirmed: input.binCountConfirmed,
    adminOverrideReason: input.adminOverrideReason,
  });
  await assertRecordGraph({ clientId: record.clientId, siteId: record.siteId });
  await setValidatedRecord(HYGIENE_COLLECTIONS.collections, record.collectionId, record);
  return record;
}

export async function assignHygieneBackupTransport(user: AuthorizedUser, input: {
  collectionId: string;
  backupVehicleUsed?: boolean;
  backupDriverUsed?: boolean;
  vehicleRegistration: string;
  driverName: string;
  reason: string;
  approvedBy: string;
}): Promise<HygieneCollection> {
  assertHygieneAdminAccess(user);
  const collection = await getCollectionUnsafe(input.collectionId);
  const timestamp = nowIso();
  await updateCollectionPatch(input.collectionId, {
    assignedDriver: input.driverName,
    vehicleRegistration: input.vehicleRegistration,
    vehicleName: input.backupVehicleUsed ? "Backup transport" : collection.vehicleName,
    backupVehicleUsed: Boolean(input.backupVehicleUsed),
    backupDriverUsed: Boolean(input.backupDriverUsed),
    backupVehicleRegistration: input.vehicleRegistration,
    backupDriverName: input.driverName,
    substitutionReason: input.reason,
    substitutionApprovedBy: input.approvedBy,
    substitutionTimestamp: timestamp,
    notes: `${collection.notes}\nBackup transport used for this CBAVO collection due to primary vehicle unavailability. Collection authorised by Torque Empire management.`,
  });
  await recordHygieneJobEvent(user, {
    eventType: "backup_vehicle_assigned",
    clientId: collection.clientId,
    siteId: collection.siteId,
    collectionId: collection.collectionId,
    manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
    notes: input.reason,
    metadata: {
      backupVehicleUsed: Boolean(input.backupVehicleUsed),
      backupDriverUsed: Boolean(input.backupDriverUsed),
      vehicleRegistration: input.vehicleRegistration,
      driverName: input.driverName,
      reason: input.reason,
      approvedBy: input.approvedBy,
    },
  });
  return getCollectionUnsafe(input.collectionId);
}

export async function generateHygieneManifest(user: AuthorizedUser, collectionId: string): Promise<HygieneManifest> {
  assertHygieneStaffMutationAccess(user);
  const collection = await getCollectionForWorkflow(collectionId, user);
  const siteSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.sites).doc(collection.siteId).get();
  const site = validateHygieneSite(siteSnapshot.data());
  const timestamp = nowIso();
  const manifestId = collection.manifestId !== "Pending" ? collection.manifestId : nextId("TE-WM");
  const record = validateHygieneManifest({
    manifestId,
    collectionId: collection.collectionId,
    clientId: collection.clientId,
    siteId: collection.siteId,
    generatorRegistration: "GPG-15-793",
    transportRegistration: "GPT-15-858",
    wasteClassification: "HW19",
    wasteType: "Sanitary/Feminine Hygiene Waste",
    quantity: collection.binCountConfirmed ?? site.binCount,
    unit: "12L bins",
    collectionDate: collection.scheduledDate,
    collectedBy: collection.assignedDriver,
    vehicleRegistration: collection.vehicleRegistration,
    disposalFacility: "Disposal facility not yet captured",
    disposalDate: null,
    disposalCertificateNo: "Disposal certificate pending",
    status: "Generated",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await setValidatedRecord(HYGIENE_COLLECTIONS.manifests, record.manifestId, record);
  await updateCollectionPatch(collection.collectionId, { manifestId: record.manifestId });
  await recordHygieneJobEvent(user, {
    eventType: "manifest_generated",
    clientId: record.clientId,
    siteId: record.siteId,
    collectionId: record.collectionId,
    manifestId: record.manifestId,
    notes: `Manifest ${record.manifestId} generated.`,
    metadata: { manifestId: record.manifestId },
  });
  return record;
}

export async function updateHygieneManifest(user: AuthorizedUser, input: Partial<HygieneManifest> & { manifestId: string }): Promise<HygieneManifest> {
  assertHygieneStaffMutationAccess(user);
  const existingSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.manifests).doc(input.manifestId).get();
  const existing = existingSnapshot.exists ? validateHygieneManifest(existingSnapshot.data()) : null;
  if (!existing) throw new Error(`Hygiene manifest does not exist: ${input.manifestId}`);
  const record = validateHygieneManifest(withUpdatedAt({ ...existing, ...input }));
  await setValidatedRecord(HYGIENE_COLLECTIONS.manifests, record.manifestId, record);
  await recordHygieneJobEvent(user, {
    eventType: record.status === "Certified" ? "disposal_certificate_uploaded" : "manifest_status_updated",
    clientId: record.clientId,
    siteId: record.siteId,
    collectionId: record.collectionId,
    manifestId: record.manifestId,
    notes: `Manifest ${record.manifestId} moved to ${record.status}.`,
    metadata: { status: record.status, disposalFacility: record.disposalFacility, disposalCertificateNo: record.disposalCertificateNo },
  });
  return record;
}

export async function upsertHygieneComplianceDocument(user: AuthorizedUser, input: Partial<HygieneComplianceDocument>): Promise<HygieneComplianceDocument> {
  assertHygieneAdminAccess(user);
  const timestamp = nowIso();
  const record = validateHygieneComplianceDocument({
    documentId: input.documentId || nextId("TE-HC"),
    documentType: input.documentType || "Compliance Document",
    title: input.title || input.documentType || "Compliance Document",
    registrationNumber: input.registrationNumber || "Pending",
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate ?? null,
    status: input.status || "Pending",
    fileUrl: input.fileUrl ?? null,
    owner: input.owner || "Torque Empire",
    uploadedAt: input.uploadedAt ?? timestamp,
    storagePath: input.storagePath ?? null,
  });
  await setValidatedRecord(HYGIENE_COLLECTIONS.complianceDocuments, record.documentId, record);
  return record;
}

export async function generateHygieneMonthlyReport(user: AuthorizedUser, period: string): Promise<HygieneReport> {
  assertHygieneAdminAccess(user);
  const data = await getHygieneDashboardData(user);
  const collections = data.collections.filter((collection) => collection.scheduledDate.startsWith(period) || collection.completedAt?.startsWith(period));
  const collectionIds = new Set(collections.map((collection) => collection.collectionId));
  const siteIds = new Set(collections.map((collection) => collection.siteId));
  const manifests = data.manifests.filter((manifest) => collectionIds.has(manifest.collectionId));
  const evidence = data.evidencePhotos.filter((photo) => collectionIds.has(photo.collectionId));
  const report = validateHygieneReport({
    reportId: `TE-HR-${period}`,
    period,
    collectionsCompleted: collections.filter((collection) => collection.status === "Completed").length,
    sitesServiced: siteIds.size,
    totalBinsServiced: manifests.reduce((total, manifest) => total + manifest.quantity, 0),
    manifestsCreated: manifests.length,
    disposalCertificatesPending: manifests.filter((manifest) => manifest.status !== "Certified").length,
    incidents: evidence.filter((photo) => photo.category === "Incident Photo").length,
    evidenceCompletionPercentage: collections.length ? Math.round((evidence.length / Math.max(collections.length * 4, 1)) * 100) : 0,
    revenueSummary: data.clients.reduce((total, client) => total + client.monthlyRevenue, 0),
    createdAt: nowIso(),
  });
  await setValidatedRecord(HYGIENE_COLLECTIONS.reports, report.reportId, report);
  return report;
}

export async function completeHygieneDriverAction(user: AuthorizedUser, input: {
  collectionId: string;
  action: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<HygieneJobEvent> {
  const collection = await getCollectionForWorkflow(input.collectionId, user);
  const events = await listCollection<HygieneJobEvent>(HYGIENE_COLLECTIONS.jobEvents);
  const collectionEvents = events.filter((event) => event.collectionId === input.collectionId);
  const hasEvent = (eventType: HygieneJobEvent["eventType"], predicate?: (event: HygieneJobEvent) => boolean) =>
    collectionEvents.some((event) => event.eventType === eventType && (!predicate || predicate(event)));
  const metadata = input.metadata ?? {};

  const eventTypeByAction: Record<string, HygieneJobEvent["eventType"]> = {
    "start-collection": "job_started",
    "vehicle-inspection": "vehicle_inspection_completed",
    "confirm-arrival": "arrived_on_site",
    "before-photo": "evidence_uploaded",
    "record-bin-count": "checklist_step_completed",
    "bag-removed": "checklist_step_completed",
    "liner-installed": "checklist_step_completed",
    "bin-sanitised": "checklist_step_completed",
    "after-photo": "evidence_uploaded",
    "capture-signature": "signature_captured",
    "generate-manifest": "manifest_generated",
    "awaiting-disposal": "awaiting_disposal",
    "complete-job": "job_completed",
  };
  const eventType = eventTypeByAction[input.action];
  if (!eventType) throw new Error("Unsupported hygiene driver action.");

  if (input.action === "confirm-arrival" && collection.status !== "In Progress") {
    throw new Error("Cannot confirm arrival before starting the collection.");
  }
  if (input.action === "complete-job") {
    const overrideReason = typeof metadata.adminOverrideReason === "string" ? metadata.adminOverrideReason.trim() : "";
    if (!hasEvent("evidence_uploaded", (event) => event.metadata.category === "Bin Before Service") && !overrideReason) {
      throw new Error("Cannot complete job without before photo.");
    }
    if (!hasEvent("evidence_uploaded", (event) => event.metadata.category === "Completion Photo") && !overrideReason) {
      throw new Error("Cannot complete job without after photo.");
    }
    if (typeof collection.binCountConfirmed !== "number" && typeof metadata.binCount !== "number" && !overrideReason) {
      throw new Error("Cannot complete job without bin count.");
    }
    if (collection.clientSignatureStatus !== "Signature captured" && !overrideReason) {
      throw new Error("Cannot complete job without signature unless admin override reason is provided.");
    }
    if (overrideReason) {
      await updateCollectionPatch(collection.collectionId, { adminOverrideReason: overrideReason });
    }
  }

  return recordHygieneJobEvent(user, {
    eventType,
    clientId: collection.clientId,
    siteId: collection.siteId,
    collectionId: collection.collectionId,
    manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
    notes: input.notes || `Driver workflow action: ${input.action}`,
    metadata,
  });
}
