import { FieldValue } from "firebase-admin/firestore";
import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";
import { getCorporateEmail } from "@/lib/corporate/companyProfile";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { sanitizeFirestoreData } from "@/lib/firebase/sanitizeFirestoreData";
import {
  DRIVER_COLLECTION_WORKFLOW_STEPS,
  deriveDriverWorkflowSnapshot,
  type DriverWorkflowStepId,
} from "@/lib/hygiene/hygieneWorkflow";
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
import { inferHygieneRecordClassification, isOperationalHygieneRecord, normalizeHygieneRecordClassification } from "@/lib/hygiene/recordClassification";
import { filterHygieneDashboardDataForVisibility } from "@/lib/hygiene/hygieneVisibility";
import {
  buildHygieneReportMetrics,
  hasRealHygieneManifestId,
  isManifestGenerationRequired,
  isWasteBearingHygieneCollection,
} from "@/lib/hygiene/hygieneManifestDisplay";
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
type HygieneDashboardDataOptions = { showTestData?: boolean };

export class HygieneWorkflowError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 409, code = "hygiene_workflow_conflict") {
    super(message);
    this.name = "HygieneWorkflowError";
    this.status = status;
    this.code = code;
  }
}

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
      sanitizeFirestoreData({
        ...payload,
        updatedAtServer: FieldValue.serverTimestamp(),
        createdAtServer: FieldValue.serverTimestamp(),
      }),
      { merge: true }
    );
}

async function assertDocumentExists(collectionName: CollectionName, documentId: string, label: string): Promise<void> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).doc(documentId).get();
  if (!snapshot.exists) {
    throw new Error(`${label} does not exist: ${documentId}`);
  }
}

async function assertOperationalHygieneClient(clientId: string) {
  const snapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.clients).doc(clientId).get()
  const client = snapshot.data()
  if (!snapshot.exists) {
    throw new Error("Hygiene client does not exist: " + clientId)
  }
  if (!client) {
    throw new Error("Hygiene client does not exist: " + clientId)
  }
  if (!isOperationalHygieneRecord(client)) {
    const classification = inferHygieneRecordClassification(client)
    throw new Error("Hygiene client " + clientId + " is classified as " + classification + " and cannot participate in operational workflows.")
  }
}

async function assertRecordGraph(input: {
  clientId: string;
  siteId?: string;
  collectionId?: string;
  manifestId?: string;
}): Promise<void> {
  await assertOperationalHygieneClient(input.clientId);

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
  const completedThisMonth = data.collections.filter((collection) => isWasteBearingHygieneCollection(collection) && collection.status === "Completed" && isInMonth(collection.completedAt, currentMonth)).length;
  const wasteBearingCollectionIds = new Set(data.collections.filter(isWasteBearingHygieneCollection).map((collection) => collection.collectionId));
  const disposalCertificatesPending = data.manifests.filter((manifest) => wasteBearingCollectionIds.has(manifest.collectionId) && manifest.quantity > 0 && (manifest.status === "Disposal Pending" || manifest.status === "Awaiting Disposal")).length;

  return {
    activeHygieneClients: data.clients.filter((client) => client.status === "Active").length,
    activeSites: data.sites.filter((site) => site.status === "Active").length,
    activeBinAssets: data.assets.filter((asset) => asset.status === "Active").length,
    collectionsDueThisWeek,
    collectionsCompletedThisMonth: completedThisMonth,
    wasteServicesCompleted: data.manifests.filter((manifest) => wasteBearingCollectionIds.has(manifest.collectionId) && manifest.quantity > 0).reduce((total, manifest) => total + manifest.quantity, 0),
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

function withUpdatedAt<T extends { updatedAt?: string }>(record: T): T {
  return { ...record, updatedAt: nowIso() };
}

function toLegacyWorkflowSteps(snapshot: ReturnType<typeof deriveDriverWorkflowSnapshot>): HygieneWorkflowStep[] {
  return DRIVER_COLLECTION_WORKFLOW_STEPS.map((step) => ({
    stepId: step.stepId,
    label: step.title,
    status: snapshot.completedSteps.includes(step.stepId) ? "Completed" : "Pending",
  }));
}

function normalizeLegacyAction(action: string): string {
  const normalized = action.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "start-job": "accept-job",
    "start-collection": "accept-job",
    "travel-to-site": "start-travel",
    arrival: "confirm-arrival",
    "confirm-arrival": "confirm-arrival",
    "before-photo": "capture-evidence",
    "after-photo": "capture-evidence",
    checklist: "bin-serviced",
    "record-bin-count": "bin-serviced",
    "bag-removed": "bin-serviced",
    "liner-installed": "bin-serviced",
    "bin-sanitised": "bin-serviced",
    signature: "capture-signature",
    "capture-signature": "capture-signature",
    "awaiting-disposal": "confirm-disposal",
  };

  return aliases[normalized] ?? normalized;
}

function getDriverWorkflowActionStepId(action: string) {
  const normalized = normalizeLegacyAction(action);
  switch (normalized) {
    case "accept-job":
      return "job-accepted" as const;
    case "start-travel":
      return "travelling-to-site" as const;
    case "confirm-arrival":
      return "arrived-on-site" as const;
    case "waste-collection":
      return "waste-collection" as const;
    case "bin-serviced":
      return "bin-serviced" as const;
    case "capture-evidence":
      return "evidence-photos-captured" as const;
    case "capture-signature":
      return "customer-signature" as const;
    case "load-waste":
      return "waste-loaded" as const;
    case "confirm-disposal":
      return "disposal-facility-confirmation" as const;
    case "complete-job":
      return "job-completed" as const;
    default:
      return null;
  }
}

function getWorkflowStatusForStep(stepId: DriverWorkflowStepId, completedCount: number): HygieneCollection["status"] {
  if (stepId === "job-completed" || completedCount >= DRIVER_COLLECTION_WORKFLOW_STEPS.length) return "Completed";
  if (stepId === "disposal-facility-confirmation") return "Awaiting Disposal";
  return "In Progress";
}

function getEventTypeForStep(stepId: ReturnType<typeof getDriverWorkflowActionStepId>): HygieneJobEvent["eventType"] | null {
  switch (stepId) {
    case "job-accepted":
      return "job_accepted";
    case "travelling-to-site":
      return "travelling_to_site";
    case "arrived-on-site":
      return "arrived_on_site";
    case "waste-collection":
      return "waste_collection_started";
    case "bin-serviced":
      return "bin_serviced";
    case "evidence-photos-captured":
      return "evidence_photos_captured";
    case "customer-signature":
      return null;
    case "waste-loaded":
      return "waste_loaded";
    case "disposal-facility-confirmation":
      return "disposal_facility_confirmed";
    case "job-completed":
      return "job_completed";
    default:
      return null;
  }
}

async function updateCollectionPatch(collectionId: string, patch: Partial<HygieneCollection> & Record<string, unknown>): Promise<void> {
  await getFirebaseAdmin()
    .collection(HYGIENE_COLLECTIONS.collections)
    .doc(collectionId)
    .set(sanitizeFirestoreData({ ...patch, updatedAtServer: FieldValue.serverTimestamp() }), { merge: true });
}

async function getCollectionUnsafe(collectionId: string): Promise<HygieneCollection> {
  const snapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(collectionId).get();
  if (!snapshot.exists) throw new Error(`Hygiene collection does not exist: ${collectionId}`);
  return validateHygieneCollection(snapshot.data());
}

export async function getHygieneDashboardData(user: AuthorizedUser, options: HygieneDashboardDataOptions = {}): Promise<HygieneDashboardData> {
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

  const visibleData = filterHygieneDashboardDataForVisibility(baseData, {
    includeTestData: user.role === "admin" ? options.showTestData === true : false,
  })

  return {
    kpis: computeKpis(visibleData),
    ...visibleData,
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
  input: HygieneEvidencePhoto & { metadata?: Record<string, unknown> }
): Promise<HygieneEvidencePhoto> {
  assertHygieneStaffMutationAccess(user);

  const metadata = input.metadata ?? {};
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
    sanitizeFirestoreData({
      evidencePhotoIds: FieldValue.arrayUnion(record.photoId),
      updatedAtServer: FieldValue.serverTimestamp(),
    }),
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
      ...metadata,
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
  const manifestIds = new Set(collections.map((collection) => collection.manifestId).filter(hasRealHygieneManifestId));

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
    throw new HygieneWorkflowError(`Hygiene collection does not exist: ${collectionId}`, 404, "hygiene_collection_not_found");
  }

  const collection = validateHygieneCollection(snapshot.data());
  await assertOperationalHygieneClient(collection.clientId);
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

  const stepIdByEventType: Partial<Record<HygieneJobEvent["eventType"], ReturnType<typeof getDriverWorkflowActionStepId>>> = {
    job_accepted: "job-accepted",
    job_started: "job-accepted",
    travelling_to_site: "travelling-to-site",
    arrived_on_site: "arrived-on-site",
    waste_collection_started: "waste-collection",
    bin_serviced: "bin-serviced",
    evidence_uploaded: "evidence-photos-captured",
    evidence_photos_captured: "evidence-photos-captured",
    checklist_step_completed: "bin-serviced",
    customer_signature_captured: "customer-signature",
    signature_captured: "customer-signature",
    waste_loaded: "waste-loaded",
    disposal_facility_confirmed: "disposal-facility-confirmation",
    awaiting_disposal: "disposal-facility-confirmation",
    job_completed: "job-completed",
  };

  const eventStepId = stepIdByEventType[event.eventType] ?? null;
  const currentSnapshot = deriveDriverWorkflowSnapshot(collection);
  const nextExpectedStep = DRIVER_COLLECTION_WORKFLOW_STEPS[currentSnapshot.completedSteps.length]?.stepId ?? "job-completed";
  const isWorkflowAdvance = Boolean(eventStepId && eventStepId === nextExpectedStep);
  const advancedStepId = isWorkflowAdvance && eventStepId ? eventStepId : null;
  const completedSteps = advancedStepId
    ? [...currentSnapshot.completedSteps, advancedStepId]
    : currentSnapshot.completedSteps;
  const stepTimestamps = {
    ...currentSnapshot.stepTimestamps,
    ...(advancedStepId ? { [advancedStepId]: event.timestamp } : {}),
  } as Record<string, string | null>;
  const nextSnapshot = deriveDriverWorkflowSnapshot({
    ...collection,
    completedSteps,
    currentStep: completedSteps.length >= DRIVER_COLLECTION_WORKFLOW_STEPS.length
      ? "job-completed"
      : DRIVER_COLLECTION_WORKFLOW_STEPS[completedSteps.length]?.stepId ?? "job-completed",
    progressPercentage: Math.min(100, Math.round((completedSteps.length / DRIVER_COLLECTION_WORKFLOW_STEPS.length) * 100)),
    stepTimestamps,
    status: completedSteps.length >= DRIVER_COLLECTION_WORKFLOW_STEPS.length ? "Completed" : collection.status,
  });

  const latitude = typeof event.metadata.latitude === "number" ? event.metadata.latitude : null;
  const longitude = typeof event.metadata.longitude === "number" ? event.metadata.longitude : null;
  const gpsAccuracy = typeof event.metadata.gpsAccuracy === "number" ? event.metadata.gpsAccuracy : null;

  const collectionPatch: Partial<HygieneCollection> & Record<string, unknown> = {
    updatedAtServer: FieldValue.serverTimestamp(),
    updatedAt: event.timestamp,
    updatedBy: user.email ?? user.uid,
    status: completedSteps.length >= DRIVER_COLLECTION_WORKFLOW_STEPS.length ? "Completed" : eventStepId === "disposal-facility-confirmation" ? "Awaiting Disposal" : collection.status === "Scheduled" && completedSteps.length > 0 ? "In Progress" : collection.status,
    completedSteps: nextSnapshot.completedSteps,
    currentStep: nextSnapshot.currentStep,
    progressPercentage: nextSnapshot.progressPercentage,
    stepTimestamps,
    workflowSteps: toLegacyWorkflowSteps(nextSnapshot),
    ...(latitude !== null && longitude !== null
      ? {
          lastGpsLocation: {
            latitude,
            longitude,
            accuracy: gpsAccuracy,
            capturedAt: event.timestamp,
          },
        }
      : {}),
  };

  if (event.eventType === "job_accepted" || event.eventType === "job_started") {
    collectionPatch.status = "In Progress";
  }

  if (event.eventType === "travelling_to_site" && !collection.arrivalTime) {
    collectionPatch.status = "In Progress";
  }

  if (event.eventType === "arrived_on_site") {
    collectionPatch.arrivalTime = event.timestamp;
  }

  if (event.eventType === "checklist_step_completed") {
    const step = typeof event.metadata.step === "string" ? event.metadata.step : "bin-serviced";
    collectionPatch.workflowSteps = toLegacyWorkflowSteps({
      ...nextSnapshot,
      completedSteps: Array.from(new Set([...nextSnapshot.completedSteps, "bin-serviced"] as DriverWorkflowStepId[])) as DriverWorkflowStepId[],
      currentStep: nextSnapshot.currentStep,
      currentStepIndex: nextSnapshot.currentStepIndex,
      progressPercentage: nextSnapshot.progressPercentage,
      remainingSteps: nextSnapshot.remainingSteps,
      stepTimestamps,
      statusLabel: nextSnapshot.statusLabel,
      statusTone: nextSnapshot.statusTone,
    });
    if (typeof event.metadata.binCount === "number") {
      collectionPatch.binCountConfirmed = event.metadata.binCount;
    }
    if (step === "record-bin-count" && typeof event.metadata.binCount === "number") {
      collectionPatch.binCountConfirmed = event.metadata.binCount;
    }
  }

  if (event.eventType === "signature_captured") {
    const signatureId = typeof event.metadata.signatureId === "string" ? event.metadata.signatureId : null;
    collectionPatch.clientSignatureStatus = "Signature captured";
    collectionPatch.clientSignatureId = signatureId;
    collectionPatch.clientSignatureStoragePath = typeof event.metadata.signatureStoragePath === "string" ? event.metadata.signatureStoragePath : null;
    collectionPatch.clientSignatureFileUrl = typeof event.metadata.signatureFileUrl === "string" ? event.metadata.signatureFileUrl : null;
    collectionPatch.clientSignatureCapturedAt = event.timestamp;
  }

  if (event.eventType === "job_completed") {
    collectionPatch.completedAt = event.timestamp;
    collectionPatch.departureTime = event.timestamp;
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

  await getFirebaseAdmin()
    .collection(HYGIENE_COLLECTIONS.collections)
    .doc(event.collectionId)
    .set(sanitizeFirestoreData(collectionPatch), { merge: true });

  if (event.eventType === "awaiting_disposal" && event.manifestId) {
    await getFirebaseAdmin()
      .collection(HYGIENE_COLLECTIONS.manifests)
      .doc(event.manifestId)
      .set(
        sanitizeFirestoreData({
          status: "Awaiting Disposal",
          updatedAt: event.timestamp,
          updatedAtServer: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
  }

  if (event.eventType === "job_completed") {
    await getFirebaseAdmin()
      .collection(HYGIENE_COLLECTIONS.collections)
      .doc(event.collectionId)
      .set(
        sanitizeFirestoreData({
          status: "Completed",
          completedAt: event.timestamp,
          departureTime: event.timestamp,
          updatedAtServer: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
  }

  return event;
}

export async function createHygieneSignature(
  user: AuthorizedUser,
  input: Omit<HygieneSignature, "signatureId" | "capturedBy" | "capturedAt"> & { signatureId?: string; capturedAt?: string; metadata?: Record<string, unknown> }
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
    sanitizeFirestoreData({
      clientSignatureStatus: "Signature captured",
      clientSignatureId: signature.signatureId,
      clientSignatureStoragePath: signature.signatureStoragePath ?? null,
      clientSignatureFileUrl: signature.signatureFileUrl,
      clientSignatureCapturedAt: signature.capturedAt,
      updatedAtServer: FieldValue.serverTimestamp(),
    }),
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
      signatureStoragePath: signature.signatureStoragePath ?? null,
      signatureFileUrl: signature.signatureFileUrl,
      ...(input.metadata ?? {}),
      audit: {
        previousStatus: collection.status,
        newStatus: getWorkflowStatusForStep("customer-signature", deriveDriverWorkflowSnapshot(collection).completedSteps.length + 1),
        timestamp: new Date().toISOString(),
        driver: user.email ?? user.uid,
        gps: input.metadata?.gps ?? {
          latitude: input.metadata?.latitude ?? null,
          longitude: input.metadata?.longitude ?? null,
          accuracy: input.metadata?.gpsAccuracy ?? null,
        },
        deviceInfo: input.metadata?.deviceInfo ?? {},
      },
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
    primaryContactEmail: input.primaryContactEmail || getCorporateEmail("support"),
    billingContact: input.billingContact || input.primaryContactName || "Pending",
    contractStartDate: input.contractStartDate || timestamp.slice(0, 10),
    contractEndDate: input.contractEndDate || timestamp.slice(0, 10),
    serviceFrequency: input.serviceFrequency || "Weekly",
    collectionDay: input.collectionDay || "Friday",
    collectionWindow: input.collectionWindow || "After 13:00",
    paymentStatus: input.paymentStatus || "Pending",
    status: input.status || "Active",
    monthlyRevenue: typeof input.monthlyRevenue === "number" ? input.monthlyRevenue : 2100,
    recordClassification: normalizeHygieneRecordClassification(input.recordClassification, input as Record<string, unknown>),
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
    clientSignatureId: input.clientSignatureId ?? null,
    clientSignatureStoragePath: input.clientSignatureStoragePath ?? null,
    clientSignatureFileUrl: input.clientSignatureFileUrl ?? null,
    clientSignatureCapturedAt: input.clientSignatureCapturedAt ?? null,
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
    collectionOutcome: input.collectionOutcome,
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
  if (!isManifestGenerationRequired(collection) && !hasRealHygieneManifestId(collection.manifestId)) {
    throw new HygieneWorkflowError("Manifest generation is not applicable to cancelled or zero-waste hygiene service records.", 409, "hygiene_manifest_not_applicable");
  }
  const siteSnapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.sites).doc(collection.siteId).get();
  const site = validateHygieneSite(siteSnapshot.data());
  const timestamp = nowIso();
  const manifestId = hasRealHygieneManifestId(collection.manifestId) ? collection.manifestId : nextId("TE-WM");
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
  const manifests = data.manifests.filter((manifest) => collectionIds.has(manifest.collectionId));
  const evidence = data.evidencePhotos.filter((photo) => collectionIds.has(photo.collectionId));
  const reportMetrics = buildHygieneReportMetrics({
    collections,
    manifests,
    evidenceCount: evidence.length,
  });
  const report = validateHygieneReport({
    reportId: `TE-HR-${period}`,
    period,
    collectionsCompleted: reportMetrics.collectionsCompleted,
    sitesServiced: reportMetrics.sitesServiced,
    totalBinsServiced: reportMetrics.totalBinsServiced,
    manifestsCreated: reportMetrics.manifestsCreated,
    disposalCertificatesPending: reportMetrics.disposalCertificatesPending,
    incidents: evidence.filter((photo) => photo.category === "Incident Photo").length,
    evidenceCompletionPercentage: reportMetrics.evidenceCompletionPercentage,
    revenueSummary: data.clients.reduce((total, client) => total + client.monthlyRevenue, 0),
    createdAt: nowIso(),
  });
  await setValidatedRecord(HYGIENE_COLLECTIONS.reports, report.reportId, report);
  return report;
}

async function verifyPersistedCollectionSignature(collection: HygieneCollection): Promise<HygieneSignature> {
  if (!collection.clientSignatureId) {
    throw new HygieneWorkflowError("Cannot complete job without persisted customer signature evidence.", 409, "hygiene_workflow_missing_persisted_signature");
  }

  const snapshot = await getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.signatures).doc(collection.clientSignatureId).get();
  if (!snapshot.exists) {
    throw new HygieneWorkflowError("Cannot complete job because persisted signature evidence cannot be found.", 409, "hygiene_workflow_signature_evidence_not_found");
  }

  const signature = validateHygieneSignature(snapshot.data());
  if (signature.collectionId !== collection.collectionId) {
    throw new HygieneWorkflowError("Cannot complete job because signature evidence is linked to a different collection.", 409, "hygiene_workflow_signature_collection_mismatch");
  }

  if (!signature.signatureStoragePath && !signature.signatureFileUrl) {
    throw new HygieneWorkflowError("Cannot complete job because signature evidence has no durable file reference.", 409, "hygiene_workflow_signature_file_missing");
  }

  if (collection.clientSignatureStoragePath && signature.signatureStoragePath && collection.clientSignatureStoragePath !== signature.signatureStoragePath) {
    throw new HygieneWorkflowError("Cannot complete job because signature storage reference does not match the collection.", 409, "hygiene_workflow_signature_reference_mismatch");
  }

  return signature;
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

  const normalizedAction = normalizeLegacyAction(input.action);
  if (normalizedAction === "vehicle-inspection") {
    return recordHygieneJobEvent(user, {
      eventType: "vehicle_inspection_completed",
      clientId: collection.clientId,
      siteId: collection.siteId,
      collectionId: collection.collectionId,
      manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
      notes: input.notes || "Vehicle inspection completed.",
      metadata,
    });
  }

  const workflowStepId = getDriverWorkflowActionStepId(normalizedAction);
  if (!workflowStepId) throw new HygieneWorkflowError("Unsupported hygiene driver action.", 400, "hygiene_action_invalid");
  if (workflowStepId === "customer-signature") {
    throw new HygieneWorkflowError("Customer signature must be captured through the signed evidence workflow.", 409, "hygiene_signature_evidence_required");
  }

  const snapshot = deriveDriverWorkflowSnapshot(collection);
  const expectedStep = DRIVER_COLLECTION_WORKFLOW_STEPS[snapshot.completedSteps.length]?.stepId ?? "job-completed";
  if (workflowStepId !== expectedStep) {
    throw new HygieneWorkflowError(`Cannot complete ${workflowStepId.replace(/-/g, " ")} before ${expectedStep.replace(/-/g, " ")}.`, 409, "hygiene_workflow_step_conflict");
  }

  if (workflowStepId === "job-completed") {
    const overrideReason = typeof metadata.adminOverrideReason === "string" ? metadata.adminOverrideReason.trim() : "";
    if (!hasEvent("evidence_uploaded", (event) => event.metadata.category === "Bin Before Service") && !overrideReason) {
      throw new HygieneWorkflowError("Cannot complete job without before photo.", 409, "hygiene_workflow_missing_before_photo");
    }
    if (!hasEvent("evidence_uploaded", (event) => event.metadata.category === "Completion Photo") && !overrideReason) {
      throw new HygieneWorkflowError("Cannot complete job without after photo.", 409, "hygiene_workflow_missing_after_photo");
    }
    if (typeof collection.binCountConfirmed !== "number" && typeof metadata.binCount !== "number" && !overrideReason) {
      throw new HygieneWorkflowError("Cannot complete job without bin count.", 409, "hygiene_workflow_missing_bin_count");
    }
    await verifyPersistedCollectionSignature(collection);
    if (overrideReason) {
      await updateCollectionPatch(collection.collectionId, { adminOverrideReason: overrideReason });
    }
  }

  const eventType = getEventTypeForStep(workflowStepId) ?? "manifest_generated";
  return recordHygieneJobEvent(user, {
    eventType,
    clientId: collection.clientId,
    siteId: collection.siteId,
    collectionId: collection.collectionId,
    manifestId: collection.manifestId === "Pending" ? null : collection.manifestId,
    notes: input.notes || `Driver workflow action: ${input.action}`,
    metadata: {
      ...metadata,
      stepId: workflowStepId,
      action: normalizedAction,
      audit: {
        previousStatus: collection.status,
        newStatus: getWorkflowStatusForStep(workflowStepId, snapshot.completedSteps.length + 1),
        timestamp: new Date().toISOString(),
        driver: user.email ?? user.uid,
        gps: metadata.gps ?? {
          latitude: metadata.latitude ?? null,
          longitude: metadata.longitude ?? null,
          accuracy: metadata.gpsAccuracy ?? null,
        },
        deviceInfo: metadata.deviceInfo ?? {},
      },
    },
  });
}
