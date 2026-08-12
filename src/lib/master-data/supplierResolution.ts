import {
  createCanonicalMasterDataEntity,
  type MasterDataRepository,
} from "@/lib/master-data/service";
import { MasterDataPolicyError, normalizeIdentityKey } from "@/lib/master-data/policy";
import type {
  CanonicalMasterEntity,
  CanonicalSupplier,
  MasterDataActor,
  MasterDataEvidenceReference,
  SupplierResolutionResult,
} from "@/types/masterData";

export type SupplierResolutionInput = {
  workspaceId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  regionCoverage?: string[];
  paymentTerms?: string | null;
  sourceId?: string | null;
  sourceCategory?: string | null;
  evidenceReferences?: MasterDataEvidenceReference[];
  quoteId?: string | null;
};

export type SupplierResolutionRepository = MasterDataRepository & {
  lookupIdentity?(entityType: "supplier", workspaceId: string, lookup: {
    canonicalId?: string | null;
    registrationNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    legalName?: string | null;
    tradingName?: string | null;
  }): Promise<CanonicalMasterEntity[]>;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourceOnlyResult(input: SupplierResolutionInput, reason: string): SupplierResolutionResult {
  return {
    status: "SOURCE_ONLY",
    supplierId: null,
    sourceId: text(input.sourceId) ?? buildSourceId(input.supplierName),
    supplierName: text(input.supplierName),
    reviewStatus: "REVIEW_REQUIRED",
    verificationStatus: "PENDING_REVIEW",
    reason,
    evidenceReferences: input.evidenceReferences ?? [],
  };
}

function supplierIdFromEvidence(input: SupplierResolutionInput): string {
  const requested = text(input.supplierId);
  if (requested) return requested;
  const registration = text(input.registrationNumber);
  if (registration) return `TE-SUP-${slug(input.supplierName ?? input.legalName ?? "SUPPLIER")}-${registration.replace(/[^0-9A-Za-z]+/g, "-")}`.toUpperCase();
  return `TE-SUP-${slug(input.supplierName ?? input.legalName ?? "SUPPLIER")}`;
}

function buildSourceId(value: unknown): string {
  return `SRC-${slug(text(value) ?? "UNRESOLVED-SUPPLIER-SOURCE")}`;
}

function slug(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "UNKNOWN";
}

function hasSupplierIdentityEvidence(input: SupplierResolutionInput): boolean {
  return Boolean(
    text(input.registrationNumber) ||
    text(input.supplierId)?.startsWith("TE-SUP-") ||
    (input.evidenceReferences ?? []).some((evidence) => evidence.sourcePath || evidence.storagePath || evidence.documentId),
  );
}

function isSourceOnly(input: SupplierResolutionInput): boolean {
  const category = text(input.sourceCategory)?.toLowerCase() ?? "";
  if (category.includes("benchmark") || category.includes("catalogue") || category.includes("statistical") || category.includes("index") || category.includes("market") || category.includes("software") || category.includes("process")) return true;
  if (!hasSupplierIdentityEvidence(input) && !text(input.email) && !text(input.phone)) return true;
  return false;
}

function buildSupplier(input: SupplierResolutionInput, actor: MasterDataActor, now: string): CanonicalSupplier {
  const supplierId = supplierIdFromEvidence(input);
  const displayName = text(input.supplierName) ?? text(input.tradingName) ?? text(input.legalName) ?? supplierId;
  const legalName = text(input.legalName) ?? displayName;
  return {
    entityType: "supplier",
    canonicalId: supplierId,
    supplierId,
    displayName,
    legalName,
    tradingName: text(input.tradingName) ?? text(input.supplierName),
    externalIdentifiers: [
      ...(text(input.registrationNumber) ? [{ system: "business_registration", value: text(input.registrationNumber) as string, status: "active" as const }] : []),
      ...(text(input.vatNumber) ? [{ system: "vat_number", value: text(input.vatNumber) as string, status: "active" as const }] : []),
    ],
    workspaceId: input.workspaceId,
    organisationId: null,
    status: "active",
    provenance: hasSupplierIdentityEvidence(input) ? "OPERATIONAL_VERIFIED" : "UNKNOWN_PROVENANCE",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: input.evidenceReferences ?? [],
    notes: input.quoteId ? `Created from supplier quote intake ${input.quoteId}; pending Master Data review.` : "Created from supplier quote intake; pending Master Data review.",
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    updatedBy: actor.uid,
    registrationNumber: text(input.registrationNumber),
    vatNumber: text(input.vatNumber),
    contactPerson: text(input.contactPerson),
    email: text(input.email),
    phone: text(input.phone),
    address: text(input.address),
    regionCoverage: input.regionCoverage?.length ? input.regionCoverage : [],
    paymentTerms: text(input.paymentTerms),
    linkedSourceId: text(input.sourceId),
    identityEvidence: input.evidenceReferences ?? [],
    documentIds: (input.evidenceReferences ?? []).map((evidence) => text(evidence.documentId)).filter((value): value is string => Boolean(value)),
  };
}

export async function resolveSupplierForQuote(input: {
  actor: MasterDataActor;
  repository: SupplierResolutionRepository;
  supplier: SupplierResolutionInput;
  now?: string;
}): Promise<SupplierResolutionResult> {
  const supplier = input.supplier;
  if (!text(supplier.workspaceId)) {
    return { ...sourceOnlyResult(supplier, "Workspace is required for supplier resolution."), status: "BLOCKED" };
  }
  if (isSourceOnly(supplier)) {
    return sourceOnlyResult(supplier, "Supplier identity is unresolved; retained as Source_ID without Supplier_ID promotion.");
  }

  const lookup = input.repository.lookupIdentity
    ? await input.repository.lookupIdentity("supplier", supplier.workspaceId, {
        canonicalId: text(supplier.supplierId),
        registrationNumber: text(supplier.registrationNumber),
        email: text(supplier.email),
        phone: text(supplier.phone),
        legalName: text(supplier.legalName) ?? text(supplier.supplierName),
        tradingName: text(supplier.tradingName),
      })
    : await input.repository.listByEntityType("supplier", supplier.workspaceId);

  const exact = lookup.filter((candidate) => isExactSupplierMatch(candidate, supplier));
  const registrationBackedIntake = Boolean(normalizeIdentityKey(supplier.registrationNumber));
  if (exact.length === 1) {
    return {
      status: exact[0].verificationStatus === "VERIFIED" ? "RESOLVED_VERIFIED" : "REVIEW_REQUIRED",
      supplierId: exact[0].canonicalId,
      sourceId: text(supplier.sourceId),
      supplierName: exact[0].displayName,
      reviewStatus: exact[0].reviewStatus,
      verificationStatus: exact[0].verificationStatus,
      reason: exact[0].verificationStatus === "VERIFIED" ? "Exact verified Master Supplier match reused." : "Exact Master Supplier match exists but still requires review.",
      evidenceReferences: supplier.evidenceReferences ?? [],
    };
  }
  if (exact.length > 1 || (!registrationBackedIntake && lookup.length > 1)) {
    return {
      status: "REVIEW_REQUIRED",
      supplierId: null,
      sourceId: text(supplier.sourceId) ?? buildSourceId(supplier.supplierName),
      supplierName: text(supplier.supplierName),
      reviewStatus: "REVIEW_REQUIRED",
      verificationStatus: "PENDING_REVIEW",
      reason: "Ambiguous supplier identity match; manual review required.",
      evidenceReferences: supplier.evidenceReferences ?? [],
    };
  }

  const now = input.now ?? new Date().toISOString();
  const draft = buildSupplier(supplier, input.actor, now);
  try {
    const created = await createCanonicalMasterDataEntity({
      actor: input.actor,
      repository: input.repository,
      entity: draft,
      reason: "Supplier quote intake created canonical supplier candidate.",
      now,
    });
    return {
      status: "CREATED_PENDING_REVIEW",
      supplierId: created.entity.canonicalId,
      sourceId: text(supplier.sourceId),
      supplierName: created.entity.displayName,
      reviewStatus: created.entity.reviewStatus,
      verificationStatus: created.entity.verificationStatus,
      reason: "Created Master Supplier candidate pending verification.",
      evidenceReferences: supplier.evidenceReferences ?? [],
    };
  } catch (error) {
    if (error instanceof MasterDataPolicyError) {
      return {
        status: "REVIEW_REQUIRED",
        supplierId: null,
        sourceId: text(supplier.sourceId) ?? buildSourceId(supplier.supplierName),
        supplierName: text(supplier.supplierName),
        reviewStatus: "REVIEW_REQUIRED",
        verificationStatus: "PENDING_REVIEW",
        reason: error.message,
        evidenceReferences: supplier.evidenceReferences ?? [],
      };
    }
    throw error;
  }
}

function isExactSupplierMatch(candidate: CanonicalMasterEntity, input: SupplierResolutionInput): boolean {
  if (candidate.entityType !== "supplier") return false;
  const supplier = candidate as CanonicalSupplier;
  const canonicalId = normalizeIdentityKey(input.supplierId);
  const registration = normalizeIdentityKey(input.registrationNumber);
  const email = normalizeIdentityKey(input.email);
  const phone = normalizeIdentityKey(input.phone);
  return Boolean(
    (canonicalId && normalizeIdentityKey(supplier.supplierId) === canonicalId) ||
    (registration && normalizeIdentityKey(supplier.registrationNumber) === registration) ||
    (email && normalizeIdentityKey(supplier.email) === email) ||
    (phone && normalizeIdentityKey(supplier.phone) === phone),
  );
}
