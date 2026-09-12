import type { HygieneComplianceDocument, HygieneEvidencePhoto, HygieneManifest } from "@/types/hygiene";

export type HygieneManifestDocumentActionVisibility = {
  viewManifest: boolean;
  downloadPdf: boolean;
  createClientPack: boolean;
  viewCertificate: boolean;
  downloadCertificate: boolean;
};

export const HYGIENE_SAVED_MANIFEST_ACTION_ORDER = [
  "View Manifest",
  "Download PDF",
  "Create Client Pack",
] as const;

function hasUsableCertificateReference(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && !/pending/i.test(value));
}

export function hasHygieneDisposalCertificateEvidence({
  manifest,
  evidencePhotos,
  complianceDocuments,
  clientName,
}: {
  manifest: HygieneManifest;
  evidencePhotos: HygieneEvidencePhoto[];
  complianceDocuments: HygieneComplianceDocument[];
  clientName?: string;
}): boolean {
  return Boolean(
    evidencePhotos.some((item) =>
      item.category === "Disposal Certificate" &&
      item.clientId === manifest.clientId &&
      item.siteId === manifest.siteId &&
      item.collectionId === manifest.collectionId &&
      item.manifestId === manifest.manifestId
    ) ||
      complianceDocuments.some((item) =>
        item.documentType === "Disposal Certificates" &&
        hasUsableCertificateReference(manifest.disposalCertificateNo) &&
        item.registrationNumber === manifest.disposalCertificateNo &&
        item.owner === clientName
      )
  );
}

export function getHygieneManifestDocumentActionVisibility({
  manifest,
  evidencePhotos,
  complianceDocuments,
  clientName,
  canOperate,
}: {
  manifest: HygieneManifest;
  evidencePhotos: HygieneEvidencePhoto[];
  complianceDocuments: HygieneComplianceDocument[];
  clientName?: string;
  canOperate: boolean;
}): HygieneManifestDocumentActionVisibility {
  const hasManifestRecord = Boolean(manifest.manifestId && manifest.manifestId.trim());
  const hasCertificate = hasHygieneDisposalCertificateEvidence({ manifest, evidencePhotos, complianceDocuments, clientName });

  return {
    viewManifest: canOperate && hasManifestRecord,
    downloadPdf: canOperate && hasManifestRecord,
    createClientPack: canOperate && hasManifestRecord,
    viewCertificate: canOperate && hasCertificate,
    downloadCertificate: canOperate && hasCertificate,
  };
}