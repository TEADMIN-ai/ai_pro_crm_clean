import type {
  HygieneCollection,
  HygieneDashboardData,
  HygieneEvidencePhoto,
  HygieneManifest,
  HygieneSite,
} from "@/types/hygiene";

export type HygieneAtAGlanceMetric = {
  label: string;
  value: number | string;
  helper: string;
  status: "available" | "empty" | "attention" | "good";
};

export type HygieneEvidenceGalleryItem = {
  photo: HygieneEvidencePhoto;
  siteName: string;
  operator: string;
  capturedAt: string;
  workflowStage: string;
  isImage: boolean;
};

export function buildHygieneAtAGlance(data: HygieneDashboardData): HygieneAtAGlanceMetric[] {
  const scheduledCollections = data.collections.filter((collection) => collection.status === "Scheduled").length;
  const completedCollections = data.collections.filter((collection) => collection.status === "Completed").length;
  const pendingDisposalVerification = data.collections.filter((collection) => collection.status === "Awaiting Disposal").length
    + data.manifests.filter((manifest) => manifest.status === "Disposal Pending" || manifest.status === "Awaiting Disposal").length;
  const incidents = data.evidencePhotos.filter((photo) => photo.category === "Incident Photo").length;

  return [
    {
      label: "Scheduled Collections",
      value: scheduledCollections,
      helper: scheduledCollections > 0 ? "Collections currently scheduled in the authorised Hygiene register." : "No scheduled collections are available in the current authorised data.",
      status: scheduledCollections > 0 ? "available" : "empty",
    },
    {
      label: "Completed Collections",
      value: completedCollections,
      helper: completedCollections > 0 ? "Collections marked completed by the controlled workflow." : "No completed collections are available in the current authorised data.",
      status: completedCollections > 0 ? "good" : "empty",
    },
    {
      label: "Pending Disposal Verification",
      value: pendingDisposalVerification,
      helper: pendingDisposalVerification > 0 ? "Collections or manifests still awaiting disposal confirmation." : "No pending disposal verification is visible in the current data.",
      status: pendingDisposalVerification > 0 ? "attention" : "good",
    },
    {
      label: "Incidents / Non-Conformances",
      value: incidents,
      helper: incidents > 0 ? "Incident evidence has been captured and needs review." : "No incident evidence is visible in the authorised evidence set.",
      status: incidents > 0 ? "attention" : "good",
    },
    {
      label: "Compliance Status",
      value: data.kpis.complianceStatus,
      helper: "Overall compliance posture from returned Hygiene compliance documents.",
      status: data.kpis.complianceStatus === "Compliance Green" ? "good" : "attention",
    },
  ];
}

export function buildVerifiedEvidenceGallery(data: HygieneDashboardData, limit = 6): HygieneEvidenceGalleryItem[] {
  const clientIds = new Set(data.clients.map((client) => client.clientId));
  const siteById = new Map(data.sites.map((site) => [site.siteId, site]));
  const collectionById = new Map(data.collections.map((collection) => [collection.collectionId, collection]));

  return data.evidencePhotos
    .filter((photo) => evidenceBelongsToVisibleGraph(photo, clientIds, siteById, collectionById))
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt))
    .slice(0, limit)
    .map((photo) => {
      const site = siteById.get(photo.siteId);
      return {
        photo,
        siteName: site?.siteName ?? photo.siteId,
        operator: photo.uploadedBy || "Operator not recorded",
        capturedAt: photo.timestampFromImage || photo.uploadedAt,
        workflowStage: photo.category,
        isImage: /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(photo.fileUrl) || !/\.pdf(\?|$)/i.test(photo.fileUrl),
      };
    });
}

function evidenceBelongsToVisibleGraph(
  photo: HygieneEvidencePhoto,
  clientIds: Set<string>,
  siteById: Map<string, HygieneSite>,
  collectionById: Map<string, HygieneCollection>
): boolean {
  if (!clientIds.has(photo.clientId)) return false;

  const site = siteById.get(photo.siteId);
  if (!site || site.clientId !== photo.clientId) return false;

  const collection = collectionById.get(photo.collectionId);
  if (!collection || collection.clientId !== photo.clientId || collection.siteId !== photo.siteId) return false;

  return true;
}

export function hasPendingDisposal(manifest: HygieneManifest): boolean {
  return manifest.status === "Disposal Pending" || manifest.status === "Awaiting Disposal";
}
