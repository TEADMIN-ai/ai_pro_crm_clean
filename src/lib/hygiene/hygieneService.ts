import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  cbavoBinAssets,
  cbavoClient,
  cbavoCollections,
  cbavoComplianceDocuments,
  cbavoDriverLogs,
  cbavoManifests,
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
  validateHygieneSite,
  validateHygieneVehicleInspection,
} from "@/lib/hygiene/hygieneValidation";
import type {
  HygieneBinAsset,
  HygieneClient,
  HygieneCollectionJob,
  HygieneComplianceDocument,
  HygieneDashboardData,
  HygieneDashboardKpis,
  HygieneDriverLog,
  HygieneEvidencePhoto,
  HygieneSite,
  HygieneVehicleInspection,
  HygieneWasteManifest,
} from "@/types/hygiene";

export const HYGIENE_COLLECTIONS = {
  clients: "hygieneClients",
  sites: "hygieneSites",
  assets: "hygieneBinAssets",
  collections: "hygieneCollections",
  manifests: "hygieneWasteManifests",
  evidencePhotos: "hygieneEvidencePhotos",
  vehicleInspections: "hygieneVehicleInspections",
  driverLogs: "hygieneDriverLogs",
  complianceDocuments: "hygieneComplianceDocuments",
} as const;

type CollectionName = (typeof HYGIENE_COLLECTIONS)[keyof typeof HYGIENE_COLLECTIONS];

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
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

function computeComplianceStatus(documents: HygieneComplianceDocument[]): HygieneDashboardKpis["complianceStatus"] {
  if (documents.some((document) => document.status === "Expired")) {
    return "Expired";
  }

  if (documents.some((document) => document.status === "Missing")) {
    return "Pending";
  }

  if (documents.some((document) => document.alert?.trim())) {
    return "Expiring Soon";
  }

  return "Valid";
}

function computeKpis(data: Omit<HygieneDashboardData, "kpis">): HygieneDashboardKpis {
  const activeClients = data.clients.filter((client) => client.status === "Active").length;
  const activeSites = data.sites.filter((site) => site.status === "Active").length;
  const activeBinAssets = data.assets.filter((asset) => asset.status === "Active").length;
  const collectionsDue = data.collections.filter((collection) => collection.status === "Scheduled").length;
  const collectionsCompleted = data.collections.filter((collection) => collection.status === "Completed").length;

  return {
    activeClients,
    activeContracts: data.clients.filter((client) => client.status === "Active" && client.contractStartDate && client.contractEndDate).length,
    activeSites,
    activeBinAssets,
    collectionsDue,
    collectionsCompleted,
    complianceStatus: computeComplianceStatus(data.complianceDocuments),
    monthlyRevenue: data.clients.reduce((total, client) => total + client.monthlyRevenue, 0),
    wasteVolumeBinServices: data.manifests.reduce((total, manifest) => total + manifest.quantity, 0),
  };
}

export async function getHygieneDashboardData(): Promise<HygieneDashboardData> {
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
  ] = await Promise.all([
    listCollection<HygieneClient>(HYGIENE_COLLECTIONS.clients),
    listCollection<HygieneSite>(HYGIENE_COLLECTIONS.sites),
    listCollection<HygieneBinAsset>(HYGIENE_COLLECTIONS.assets),
    listCollection<HygieneCollectionJob>(HYGIENE_COLLECTIONS.collections),
    listCollection<HygieneWasteManifest>(HYGIENE_COLLECTIONS.manifests),
    listCollection<HygieneEvidencePhoto>(HYGIENE_COLLECTIONS.evidencePhotos),
    listCollection<HygieneVehicleInspection>(HYGIENE_COLLECTIONS.vehicleInspections),
    listCollection<HygieneDriverLog>(HYGIENE_COLLECTIONS.driverLogs),
    listCollection<HygieneComplianceDocument>(HYGIENE_COLLECTIONS.complianceDocuments),
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
  };

  return {
    kpis: computeKpis(baseData),
    ...baseData,
  };
}

export async function seedCbavoHygieneDataset(): Promise<{ seeded: boolean; records: number }> {
  const clients = [validateHygieneClient(cbavoClient)];
  const sites = cbavoSites.map(validateHygieneSite);
  const assets = cbavoBinAssets.map(validateHygieneBinAsset);
  const collections = cbavoCollections.map(validateHygieneCollection);
  const manifests = cbavoManifests.map(validateHygieneManifest);
  const vehicleInspections = cbavoVehicleInspections.map(validateHygieneVehicleInspection);
  const driverLogs = cbavoDriverLogs.map(validateHygieneDriverLog);
  const complianceDocuments = cbavoComplianceDocuments.map(validateHygieneComplianceDocument);

  await Promise.all([
    ...clients.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.clients, record.clientId, record)),
    ...sites.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.sites, record.siteId, record)),
    ...assets.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.assets, record.assetId, record)),
    ...collections.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.collections, record.collectionId, record)),
    ...manifests.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.manifests, record.manifestId, record)),
    ...vehicleInspections.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.vehicleInspections, record.inspectionId, record)),
    ...driverLogs.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.driverLogs, record.driverLogId, record)),
    ...complianceDocuments.map((record) => setValidatedRecord(HYGIENE_COLLECTIONS.complianceDocuments, record.documentId, record)),
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
      complianceDocuments.length,
  };
}

export async function createHygieneEvidencePhoto(input: HygieneEvidencePhoto): Promise<HygieneEvidencePhoto> {
  const record = validateHygieneEvidencePhoto(input);
  await setValidatedRecord(HYGIENE_COLLECTIONS.evidencePhotos, record.photoId, record);

  const collectionRef = getFirebaseAdmin().collection(HYGIENE_COLLECTIONS.collections).doc(record.collectionId);
  await collectionRef.set(
    {
      evidencePhotoIds: FieldValue.arrayUnion(record.photoId),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return record;
}
