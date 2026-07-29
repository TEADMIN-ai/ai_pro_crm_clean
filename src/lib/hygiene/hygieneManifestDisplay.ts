import type {
  HygieneCollection,
  HygieneCollectionOutcome,
  HygieneManifest,
  HygieneManifestDisplayStatus,
} from "@/types/hygiene";

export const HYGIENE_MANIFEST_DISPLAY_LABELS: Record<HygieneManifestDisplayStatus, string> = {
  generated: "Generated",
  pending_generation: "Pending generation",
  zero_waste_record: "Zero-waste service record",
  not_applicable_cancelled: "Not applicable — cancelled",
};

export const HYGIENE_MANIFEST_DISPLAY_TONES: Record<HygieneManifestDisplayStatus, "success" | "warning" | "info" | "neutral"> = {
  generated: "success",
  pending_generation: "warning",
  zero_waste_record: "info",
  not_applicable_cancelled: "neutral",
};

const NON_MANIFEST_REFERENCE_VALUES = new Set(["", "pending", "not applicable", "n/a", "na", "none", "null"]);

export function hasRealHygieneManifestId(manifestId: string | null | undefined): boolean {
  return !NON_MANIFEST_REFERENCE_VALUES.has((manifestId ?? "").trim().toLowerCase());
}

function notesIndicateZeroWaste(notes: string | null | undefined): boolean {
  const normalized = (notes ?? "").toLowerCase();
  return /\b(no waste collected|zero[-\s]?waste|site attendance only|attendance only)\b/.test(normalized);
}

export function deriveHygieneCollectionOutcome(collection: Pick<HygieneCollection, "status" | "collectionOutcome" | "binCountConfirmed" | "notes">): HygieneCollectionOutcome {
  if (collection.status === "Cancelled" || collection.collectionOutcome === "cancelled") return "cancelled";
  if (collection.collectionOutcome === "zero_waste") return "zero_waste";
  if (collection.collectionOutcome === "waste_collected") return "waste_collected";
  if (collection.binCountConfirmed === 0 || notesIndicateZeroWaste(collection.notes)) return "zero_waste";
  return "waste_collected";
}

export function isWasteBearingHygieneCollection(collection: Pick<HygieneCollection, "status" | "collectionOutcome" | "binCountConfirmed" | "notes">): boolean {
  return deriveHygieneCollectionOutcome(collection) === "waste_collected";
}

export function deriveManifestDisplayStatus(collection: Pick<HygieneCollection, "status" | "collectionOutcome" | "manifestId" | "binCountConfirmed" | "notes">): HygieneManifestDisplayStatus {
  const outcome = deriveHygieneCollectionOutcome(collection);
  if (outcome === "cancelled") return "not_applicable_cancelled";
  if (outcome === "zero_waste") return "zero_waste_record";
  if (hasRealHygieneManifestId(collection.manifestId)) return "generated";
  return "pending_generation";
}

export function isManifestGenerationRequired(collection: Pick<HygieneCollection, "status" | "collectionOutcome" | "manifestId" | "binCountConfirmed" | "notes">): boolean {
  return collection.status === "Completed"
    && isWasteBearingHygieneCollection(collection)
    && !hasRealHygieneManifestId(collection.manifestId);
}
export function isWasteBearingManifest(manifest: Pick<HygieneManifest, "quantity">): boolean {
  return manifest.quantity > 0;
}

export function buildHygieneReportMetrics(input: {
  collections: HygieneCollection[];
  manifests: HygieneManifest[];
  evidenceCount: number;
}) {
  const wasteBearingCollections = input.collections.filter(isWasteBearingHygieneCollection);
  const wasteBearingCollectionIds = new Set(wasteBearingCollections.map((collection) => collection.collectionId));
  const wasteBearingManifests = input.manifests.filter((manifest) =>
    wasteBearingCollectionIds.has(manifest.collectionId) && isWasteBearingManifest(manifest)
  );
  const siteIds = new Set(wasteBearingCollections.map((collection) => collection.siteId));

  return {
    collectionsCompleted: wasteBearingCollections.filter((collection) => collection.status === "Completed").length,
    sitesServiced: siteIds.size,
    totalBinsServiced: wasteBearingManifests.reduce((total, manifest) => total + manifest.quantity, 0),
    manifestsCreated: wasteBearingManifests.length,
    disposalCertificatesPending: wasteBearingManifests.filter((manifest) => manifest.status !== "Certified").length,
    evidenceCompletionPercentage: input.collections.length ? Math.round((input.evidenceCount / Math.max(input.collections.length * 4, 1)) * 100) : 0,
  };
}
