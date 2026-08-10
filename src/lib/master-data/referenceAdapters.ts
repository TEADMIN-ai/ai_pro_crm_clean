import type { Deal } from "@/types/deal";
import type { HygieneClient, HygieneSite } from "@/types/hygiene";
import type { Material, PriceHistory, QSSupplierProfile, SupplierPrice } from "@/types/qs";
import type {
  CanonicalReferenceResolution,
  CanonicalSourceRegistryEntry,
  MasterDataProvenance,
  SourceRegistryCategory,
} from "@/types/masterData";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolution(input: CanonicalReferenceResolution): CanonicalReferenceResolution {
  return input;
}

export function resolveOpportunityClientReference(deal: Deal & AnyRecord): CanonicalReferenceResolution {
  const explicitClientId = text(deal.clientId) ?? text(deal.Client_ID) ?? text(record(deal.masterData).clientId);
  if (explicitClientId) {
    return resolution({
      status: "RESOLVED",
      entityType: "client",
      canonicalId: explicitClientId,
      sourceReference: explicitClientId,
      reason: "Opportunity carries an explicit canonical client reference.",
      provenance: "SYSTEM_CANONICAL",
      verificationStatus: "PENDING_REVIEW",
    });
  }

  const clientName = text(deal.clientName) ?? text(deal.issuingAuthority) ?? text(record(deal.tenderAnalysis).issuingAuthority);
  return resolution({
    status: clientName ? "REVIEW_REQUIRED" : "UNRESOLVED",
    entityType: "client",
    canonicalId: null,
    sourceReference: clientName,
    reason: clientName ? "Opportunity has a client name but no canonical Client_ID." : "Opportunity has no usable client reference.",
    provenance: clientName ? "USER_CONFIRMED" : "UNKNOWN_PROVENANCE",
    verificationStatus: "PENDING_REVIEW",
  });
}

export function resolveHygieneClientReference(client: HygieneClient): CanonicalReferenceResolution {
  return resolution({
    status: client.recordClassification === "PRODUCTION" ? "RESOLVED" : "REVIEW_REQUIRED",
    entityType: "client",
    canonicalId: client.clientId,
    sourceReference: client.clientName,
    reason: client.recordClassification === "PRODUCTION" ? "Hygiene production client preserves its existing Client_ID." : "Non-production hygiene client cannot become operational master data.",
    provenance: client.recordClassification === "PRODUCTION" ? "SYSTEM_CANONICAL" : hygieneClassificationToProvenance(client.recordClassification),
    verificationStatus: "PENDING_REVIEW",
  });
}

export function resolveHygieneSiteReference(site: HygieneSite): CanonicalReferenceResolution {
  return resolution({
    status: site.clientId && site.siteId ? "RESOLVED" : "UNRESOLVED",
    entityType: "site",
    canonicalId: site.siteId || null,
    sourceReference: site.siteName,
    reason: site.clientId && site.siteId ? "Hygiene site preserves existing Site_ID and Client_ID relationship." : "Hygiene site is missing a durable Site_ID or Client_ID.",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "PENDING_REVIEW",
  });
}

export function resolveQsItemReference(material: Material): CanonicalReferenceResolution {
  const itemId = text(material.materialId);
  return resolution({
    status: itemId ? "RESOLVED" : "UNRESOLVED",
    entityType: "item",
    canonicalId: itemId,
    sourceReference: material.name,
    reason: itemId ? "QS material ID can be treated as the item identity reference; pricing remains separate." : "QS material has no durable item identifier.",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "PENDING_REVIEW",
  });
}

export function assertItemIdentitySeparateFromPricing(input: {
  item: Material;
  supplierPrices?: SupplierPrice[];
  priceHistory?: PriceHistory[];
}): boolean {
  const materialId = input.item.materialId;
  return [...(input.supplierPrices ?? []), ...(input.priceHistory ?? [])].every((price) => price.materialId === materialId && price.price !== undefined);
}

export function classifySourceRegistryCategory(value: unknown): SourceRegistryCategory {
  const normalized = text(value)?.toLowerCase().replace(/[^a-z0-9]+/g, " ") ?? "";
  if (normalized.includes("stat") || normalized.includes("index")) return "statistical_index_source";
  if (normalized.includes("market") || normalized.includes("intelligence")) return "market_intelligence_source";
  if (normalized.includes("benchmark")) return "benchmark_source";
  if (normalized.includes("catalog")) return "catalogue_source";
  if (normalized.includes("software") || normalized.includes("process")) return "process_software_source";
  return "supplier_pricing_source";
}

export function sourceRegistryEntryFromV3(input: {
  sourceId: string;
  sourceName: string;
  category: SourceRegistryCategory;
  workspaceId: string;
  actorUid: string;
  now: string;
}): CanonicalSourceRegistryEntry {
  return {
    entityType: "source",
    canonicalId: input.sourceId,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    category: input.category,
    displayName: input.sourceName,
    legalName: null,
    tradingName: null,
    externalIdentifiers: [{ system: "V3_SOURCE_REGISTRY", value: input.sourceId, status: "active" }],
    workspaceId: input.workspaceId,
    organisationId: null,
    status: "active",
    provenance: "USER_CONFIRMED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [],
    notes: "Source Registry entry is not a Supplier_ID and must not be promoted without genuine supplier identity evidence.",
    createdAt: input.now,
    updatedAt: input.now,
    createdBy: input.actorUid,
    updatedBy: input.actorUid,
  };
}

export function supplierProfileRequiresMasterDataReview(supplier: QSSupplierProfile): CanonicalReferenceResolution {
  const hasRegistration = Boolean(text(supplier.companyRegistrationNumber));
  return resolution({
    status: hasRegistration ? "REVIEW_REQUIRED" : "UNRESOLVED",
    entityType: "supplier",
    canonicalId: supplier.supplierId || null,
    sourceReference: supplier.supplierName,
    reason: hasRegistration ? "QS supplier profile has identity material but still requires Master Data verification." : "QS supplier profile lacks registration evidence and remains unresolved.",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "PENDING_REVIEW",
  });
}

function hygieneClassificationToProvenance(value: HygieneClient["recordClassification"]): MasterDataProvenance {
  if (value === "TEST") return "TEST_DATA";
  if (value === "DEMO") return "DEMO_DATA";
  if (value === "ARCHIVED") return "UNKNOWN_PROVENANCE";
  return "SYSTEM_CANONICAL";
}
