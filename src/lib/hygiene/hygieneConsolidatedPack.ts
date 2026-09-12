import { getFirebaseAdmin } from "@/lib/firebase/adminFirestore";
import { HYGIENE_COLLECTIONS, assertHygieneInternalAccess } from "@/lib/hygiene/hygieneAccess";
import {
  validateHygieneClient,
  validateHygieneCollection,
  validateHygieneComplianceDocument,
  validateHygieneEvidencePhoto,
  validateHygieneManifest,
  validateHygieneSite,
} from "@/lib/hygiene/hygieneValidation";
import {
  evaluateGovernedStoragePath,
  isExpectedHygieneCollectionEvidencePath,
} from "@/lib/master-data/storagePathPolicy";
import type { AuthorizedUser } from "@/lib/server/authz";
import type {
  HygieneClient,
  HygieneCollection,
  HygieneComplianceDocument,
  HygieneEvidencePhoto,
  HygieneManifest,
  HygieneSite,
} from "@/types/hygiene";

export type ConsolidatedPackFilters = {
  clientId: string;
  startDate?: string | null;
  endDate?: string | null;
  siteId?: string | null;
  includeIncomplete?: boolean;
};

export type ConsolidatedEvidenceItem = {
  evidenceId: string;
  kind: "photo" | "compliance";
  label: string;
  manifestId: string;
  collectionId: string;
  storagePath: string | null;
  certificateReference: string | null;
};

export type ConsolidatedCollectionEntry = {
  collection: HygieneCollection;
  manifest: HygieneManifest;
  site: HygieneSite;
  disposalEvidence: ConsolidatedEvidenceItem[];
  evidenceStatus: "Linked evidence" | "Pending disposal evidence";
};

export type ConsolidatedHygieneClientPackData = {
  client: HygieneClient;
  period: { startDate: string | null; endDate: string | null };
  siteFilter: HygieneSite | null;
  entries: ConsolidatedCollectionEntry[];
  summary: {
    sitesIncluded: string[];
    collectionCount: number;
    manifestCount: number;
    evidenceItemCount: number;
    totalBins: number | null;
    totalRecordedWasteWeight: null;
    disposalStatus: {
      disposed: number;
      pendingEvidence: number;
      generatedIncomplete: number;
    };
  };
  generatedAt: string;
};

async function listRecords<T>(collectionName: string): Promise<T[]> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function dateInRange(dateValue: string, startDate: string | null, endDate: string | null): boolean {
  const date = dateValue.slice(0, 10);
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function isEligibleCollection(collection: HygieneCollection, manifest: HygieneManifest, includeIncomplete: boolean): boolean {
  if (includeIncomplete) return true;
  if (collection.status === "Completed") return true;
  return manifest.status === "Disposed" || manifest.status === "Certified" || manifest.status === "Certificate Received" || manifest.status === "Completed";
}

function hasUsableCertificateReference(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && !/pending/i.test(value));
}

function evidenceStoragePath(item: HygieneEvidencePhoto | HygieneComplianceDocument): string | null {
  const rawPath = "storagePath" in item ? item.storagePath : null;
  const rawUrl = "fileUrl" in item ? item.fileUrl : null;
  return clean(rawPath ?? rawUrl ?? null);
}

function normalizedEvidencePath(item: HygieneEvidencePhoto | HygieneComplianceDocument, manifest: HygieneManifest): string | null {
  const rawPath = evidenceStoragePath(item);
  if (!rawPath || !/\.pdf(?:$|\?)/i.test(rawPath)) return null;
  const decision = evaluateGovernedStoragePath(rawPath, ["hygiene/evidence/", "hygiene/compliance/"]);
  if (!decision.allowed || !decision.normalizedPath) return null;
  if (
    decision.normalizedPath.startsWith("hygiene/evidence/") &&
    !isExpectedHygieneCollectionEvidencePath({
      path: decision.normalizedPath,
      clientId: manifest.clientId,
      collectionId: manifest.collectionId,
    })
  ) {
    return null;
  }
  return decision.normalizedPath;
}

function buildEvidenceItems(input: {
  manifest: HygieneManifest;
  client: HygieneClient;
  photos: HygieneEvidencePhoto[];
  complianceDocuments: HygieneComplianceDocument[];
}): ConsolidatedEvidenceItem[] {
  const photoEvidence = input.photos
    .filter((photo) =>
      photo.category === "Disposal Certificate" &&
      photo.clientId === input.manifest.clientId &&
      photo.siteId === input.manifest.siteId &&
      photo.collectionId === input.manifest.collectionId &&
      photo.manifestId === input.manifest.manifestId
    )
    .map((photo): ConsolidatedEvidenceItem => ({
      evidenceId: photo.photoId,
      kind: "photo",
      label: photo.category,
      manifestId: input.manifest.manifestId,
      collectionId: input.manifest.collectionId,
      storagePath: normalizedEvidencePath(photo, input.manifest),
      certificateReference: hasUsableCertificateReference(input.manifest.disposalCertificateNo) ? input.manifest.disposalCertificateNo : null,
    }));

  const documentEvidence = input.complianceDocuments
    .filter((document) =>
      document.documentType === "Disposal Certificates" &&
      hasUsableCertificateReference(input.manifest.disposalCertificateNo) &&
      document.registrationNumber === input.manifest.disposalCertificateNo &&
      document.owner === input.client.clientName
    )
    .map((document): ConsolidatedEvidenceItem => ({
      evidenceId: document.documentId,
      kind: "compliance",
      label: document.title,
      manifestId: input.manifest.manifestId,
      collectionId: input.manifest.collectionId,
      storagePath: normalizedEvidencePath(document, input.manifest),
      certificateReference: document.registrationNumber,
    }));

  return [...photoEvidence, ...documentEvidence];
}

export async function getConsolidatedHygieneClientPackData(
  user: AuthorizedUser,
  filters: ConsolidatedPackFilters,
): Promise<ConsolidatedHygieneClientPackData> {
  assertHygieneInternalAccess(user);
  const clientId = clean(filters.clientId);
  if (!clientId) throw new Error("clientId is required.");

  const startDate = clean(filters.startDate);
  const endDate = clean(filters.endDate);
  if (startDate && endDate && startDate > endDate) throw new Error("Reporting period start date must be before end date.");
  const siteId = clean(filters.siteId);

  const [clients, sites, collections, manifests, photos, complianceDocuments] = await Promise.all([
    listRecords<HygieneClient>(HYGIENE_COLLECTIONS.clients).then((records) => records.map(validateHygieneClient)),
    listRecords<HygieneSite>(HYGIENE_COLLECTIONS.sites).then((records) => records.map(validateHygieneSite)),
    listRecords<HygieneCollection>(HYGIENE_COLLECTIONS.collections).then((records) => records.map(validateHygieneCollection)),
    listRecords<HygieneManifest>(HYGIENE_COLLECTIONS.manifests).then((records) => records.map(validateHygieneManifest)),
    listRecords<HygieneEvidencePhoto>(HYGIENE_COLLECTIONS.evidencePhotos).then((records) => records.map(validateHygieneEvidencePhoto)),
    listRecords<HygieneComplianceDocument>(HYGIENE_COLLECTIONS.complianceDocuments).then((records) => records.map(validateHygieneComplianceDocument)),
  ]);

  const client = clients.find((record) => record.clientId === clientId);
  if (!client) throw new Error("Hygiene client was not found.");
  const siteIndex = new Map(sites.filter((site) => site.clientId === clientId).map((site) => [site.siteId, site]));
  const selectedSite = siteId ? siteIndex.get(siteId) ?? null : null;
  if (siteId && !selectedSite) throw new Error("Hygiene site does not belong to the selected client.");
  const manifestIndex = new Map(manifests.map((manifest) => [manifest.collectionId, manifest]));

  const entries = collections
    .filter((collection) => collection.clientId === clientId)
    .filter((collection) => !siteId || collection.siteId === siteId)
    .filter((collection) => dateInRange(collection.scheduledDate, startDate, endDate))
    .map((collection) => {
      const manifest = manifestIndex.get(collection.collectionId);
      const site = siteIndex.get(collection.siteId);
      if (!manifest || !site) return null;
      if (
        manifest.clientId !== collection.clientId ||
        manifest.siteId !== collection.siteId ||
        manifest.collectionId !== collection.collectionId
      ) {
        throw new Error("Hygiene consolidated pack relationship check failed.");
      }
      if (!isEligibleCollection(collection, manifest, filters.includeIncomplete === true)) return null;
      const disposalEvidence = buildEvidenceItems({ manifest, client, photos, complianceDocuments });
      return {
        collection,
        manifest,
        site,
        disposalEvidence,
        evidenceStatus: disposalEvidence.length > 0 ? "Linked evidence" as const : "Pending disposal evidence" as const,
      };
    })
    .filter((entry): entry is ConsolidatedCollectionEntry => Boolean(entry))
    .sort((a, b) => a.collection.scheduledDate.localeCompare(b.collection.scheduledDate) || a.collection.collectionId.localeCompare(b.collection.collectionId));

  const sitesIncluded = Array.from(new Set(entries.map((entry) => entry.site.siteName))).sort();
  const totalBins = entries.reduce((total, entry) => total + entry.manifest.quantity, 0);
  const pendingEvidence = entries.filter((entry) => entry.disposalEvidence.length === 0).length;

  return {
    client,
    period: { startDate, endDate },
    siteFilter: selectedSite,
    entries,
    summary: {
      sitesIncluded,
      collectionCount: entries.length,
      manifestCount: entries.length,
      evidenceItemCount: entries.reduce((total, entry) => total + entry.disposalEvidence.length, 0),
      totalBins: entries.length > 0 ? totalBins : null,
      totalRecordedWasteWeight: null,
      disposalStatus: {
        disposed: entries.filter((entry) => entry.disposalEvidence.length > 0).length,
        pendingEvidence,
        generatedIncomplete: entries.filter((entry) => entry.manifest.status === "Generated" || entry.manifest.status === "Disposal Pending").length,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}
