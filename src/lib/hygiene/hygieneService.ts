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
  validateHygieneManifest,
  validateHygieneReport,
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
  HygieneManifest,
  HygieneReport,
  HygieneSite,
  HygieneVehicleInspection,
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
} as const;

type CollectionName = (typeof HYGIENE_COLLECTIONS)[keyof typeof HYGIENE_COLLECTIONS];

export function assertHygieneInternalAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
    throw new AuthorizationError("Hygiene dashboard is restricted to internal Torque Empire users.", 403);
  }
}

export function assertHygieneAdminAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager") {
    throw new AuthorizationError("Only admin and manager users may manage hygiene master data.", 403);
  }
}

export function assertHygieneStaffMutationAccess(user: AuthorizedUser): void {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
    throw new AuthorizationError("Only internal operations users may update hygiene collection records.", 403);
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
  const disposalCertificatesPending = data.manifests.filter((manifest) => manifest.status === "Disposal Pending").length;

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

  return record;
}
