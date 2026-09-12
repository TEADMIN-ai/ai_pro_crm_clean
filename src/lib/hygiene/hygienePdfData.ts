import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { HYGIENE_COLLECTIONS, assertHygieneInternalAccess } from "@/lib/hygiene/hygieneService";
import {
  validateHygieneClient,
  validateHygieneCollection,
  validateHygieneComplianceDocument,
  validateHygieneEvidencePhoto,
  validateHygieneManifest,
  validateHygieneSignature,
  validateHygieneSite,
} from "@/lib/hygiene/hygieneValidation";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { HygieneComplianceDocument, HygieneEvidencePhoto, HygieneSignature } from "@/types/hygiene";
import type { HygienePdfDocumentData as BrandingPdfDocumentData } from "@/lib/hygiene/hygienePdfBranding";

async function getRecord<T>(collectionName: string, documentId: string, label: string): Promise<T> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).doc(documentId).get();
  if (!snapshot.exists) throw new Error(`${label} was not found.`);
  return snapshot.data() as T;
}

async function listRecords<T>(collectionName: string): Promise<T[]> {
  const snapshot = await getFirebaseAdmin().collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

function assertRelationship(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function hasUsableCertificateReference(manifestCertificateNo: string): boolean {
  return Boolean(manifestCertificateNo && !/pending/i.test(manifestCertificateNo));
}

function isManifestDisposalPhoto(record: HygieneEvidencePhoto, manifestId: string, collectionId: string, clientId: string, siteId: string): boolean {
  return record.category === "Disposal Certificate" &&
    record.clientId === clientId &&
    record.siteId === siteId &&
    record.collectionId === collectionId &&
    record.manifestId === manifestId;
}

function isManifestComplianceDocument(record: HygieneComplianceDocument, clientName: string, certificateNo: string): boolean {
  if (record.documentType !== "Disposal Certificates" || !hasUsableCertificateReference(certificateNo)) return false;
  return record.owner === clientName && record.registrationNumber === certificateNo;
}

export async function getHygieneManifestPdfData(user: AuthorizedUser, manifestId: string): Promise<BrandingPdfDocumentData> {
  assertHygieneInternalAccess(user);
  const manifest = validateHygieneManifest(await getRecord(HYGIENE_COLLECTIONS.manifests, manifestId, "Hygiene manifest"));
  const [collection, client, site, photos, complianceDocuments, signatures] = await Promise.all([
    getRecord(HYGIENE_COLLECTIONS.collections, manifest.collectionId, "Hygiene collection").then(validateHygieneCollection),
    getRecord(HYGIENE_COLLECTIONS.clients, manifest.clientId, "Hygiene client").then(validateHygieneClient),
    getRecord(HYGIENE_COLLECTIONS.sites, manifest.siteId, "Hygiene site").then(validateHygieneSite),
    listRecords(HYGIENE_COLLECTIONS.evidencePhotos).then((records) => records.map(validateHygieneEvidencePhoto)),
    listRecords(HYGIENE_COLLECTIONS.complianceDocuments).then((records) => records.map(validateHygieneComplianceDocument)),
    listRecords(HYGIENE_COLLECTIONS.signatures).then((records) => records.map(validateHygieneSignature)),
  ]);

  assertRelationship(collection.collectionId === manifest.collectionId, "Hygiene manifest collection relationship is invalid.");
  assertRelationship(collection.clientId === manifest.clientId, "Hygiene manifest client relationship is invalid.");
  assertRelationship(collection.siteId === manifest.siteId, "Hygiene manifest site relationship is invalid.");
  assertRelationship(site.clientId === client.clientId && site.siteId === manifest.siteId, "Hygiene site relationship is invalid.");

  const disposalPhotos = photos.filter((photo) => isManifestDisposalPhoto(photo, manifest.manifestId, manifest.collectionId, manifest.clientId, manifest.siteId));
  const disposalDocuments = complianceDocuments.filter((document) => isManifestComplianceDocument(document, client.clientName, manifest.disposalCertificateNo));
  const persistedSignatures = signatures.filter((signature: HygieneSignature) =>
    signature.clientId === manifest.clientId &&
    signature.siteId === manifest.siteId &&
    signature.collectionId === manifest.collectionId &&
    (!signature.manifestId || signature.manifestId === manifest.manifestId)
  );

  return {
    manifest,
    collection,
    client,
    site,
    disposalEvidence: [...disposalPhotos, ...disposalDocuments],
    signatures: persistedSignatures,
    generatedAt: new Date().toISOString(),
  };
}
