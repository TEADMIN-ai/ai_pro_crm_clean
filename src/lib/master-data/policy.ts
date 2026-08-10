import { AuthorizationError, isPrivilegedRole } from "@/lib/server/authz";
import type {
  CanonicalMasterEntity,
  CanonicalSourceRegistryEntry,
  CanonicalSupplier,
  MasterDataActor,
  MasterDataEntityType,
  MasterDataProvenance,
  MasterDataVerificationStatus,
  SourceRegistryCategory,
} from "@/types/masterData";

export const MASTER_DATA_POLICY_VERSION = "master-data-foundation-v1";

export const MASTER_DATA_PROVENANCE_VALUES = [
  "OPERATIONAL_VERIFIED",
  "SYSTEM_CANONICAL",
  "USER_CONFIRMED",
  "BENCHMARK_REFERENCE",
  "SEED_DATA",
  "DEMO_DATA",
  "TEST_DATA",
  "STATIC_UI_DATA",
  "UNKNOWN_PROVENANCE",
] as const satisfies readonly MasterDataProvenance[];

export const MASTER_DATA_VERIFICATION_VALUES = [
  "PENDING_REVIEW",
  "VERIFIED",
  "REJECTED",
  "ARCHIVED",
] as const satisfies readonly MasterDataVerificationStatus[];

export class MasterDataPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MasterDataPolicyError";
  }
}

export function normalizeIdentityKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
}

export function normalizeDisplayNameKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ") : "";
}

export function isValidProvenance(value: unknown): value is MasterDataProvenance {
  return MASTER_DATA_PROVENANCE_VALUES.includes(value as MasterDataProvenance);
}

export function isValidVerificationStatus(value: unknown): value is MasterDataVerificationStatus {
  return MASTER_DATA_VERIFICATION_VALUES.includes(value as MasterDataVerificationStatus);
}

export function assertValidMasterDataState(entity: CanonicalMasterEntity): void {
  if (!entity.canonicalId.trim()) {
    throw new MasterDataPolicyError("CANONICAL_ID_REQUIRED", "Canonical ID is required.", 400);
  }
  if (!entity.workspaceId.trim()) {
    throw new MasterDataPolicyError("WORKSPACE_REQUIRED", "Workspace is required for canonical master data.", 400);
  }
  if (!isValidProvenance(entity.provenance)) {
    throw new MasterDataPolicyError("PROVENANCE_INVALID", "Malformed provenance state is rejected.", 400, { provenance: entity.provenance });
  }
  if (!isValidVerificationStatus(entity.verificationStatus)) {
    throw new MasterDataPolicyError("VERIFICATION_INVALID", "Malformed verification state is rejected.", 400, { verificationStatus: entity.verificationStatus });
  }
  if (entity.verificationStatus === "VERIFIED" && isLowerPriorityNonOperational(entity.provenance)) {
    throw new MasterDataPolicyError("LOW_PRIORITY_DATA_CANNOT_VERIFY", `${entity.provenance} cannot silently become VERIFIED.`, 409);
  }
  if (entity.entityType === "supplier") {
    assertSupplierHasIdentityEvidence(entity);
  }
  if (entity.entityType === "item" && entity.priceReferenceIds.length && !entity.itemCode.trim()) {
    throw new MasterDataPolicyError("ITEM_IDENTITY_REQUIRED", "Item identity must remain explicit and separate from pricing references.", 400);
  }
}

export function assertMasterDataWriteAuthority(actor: MasterDataActor, workspaceId: string): void {
  if (!actor.uid.trim()) {
    throw new AuthorizationError("unauthorized", 401);
  }
  if (!isPrivilegedRole(actor.role)) {
    throw new AuthorizationError("Master Data writes require an internal privileged role.", 403);
  }
  if (!workspaceId.trim()) {
    throw new AuthorizationError("Workspace context is required for Master Data writes.", 403);
  }
  if (actor.workspaceId && actor.workspaceId !== workspaceId) {
    throw new AuthorizationError("Cross-workspace Master Data writes are blocked.", 403);
  }
}

export function assertSupplierHasIdentityEvidence(supplier: CanonicalSupplier): void {
  const registration = normalizeIdentityKey(supplier.registrationNumber);
  const identityEvidence = supplier.identityEvidence.length > 0 || supplier.sourceEvidence.length > 0;
  const contactEvidence = Boolean(supplier.email || supplier.phone || supplier.address);
  if (supplier.verificationStatus === "VERIFIED" && !registration && !identityEvidence) {
    throw new MasterDataPolicyError("SUPPLIER_IDENTITY_EVIDENCE_REQUIRED", "Verified supplier identity requires registration or direct identity evidence.", 409);
  }
  if (!registration && !identityEvidence && !contactEvidence) {
    throw new MasterDataPolicyError("SUPPLIER_UNRESOLVED", "Supplier identity remains pending until genuine identity evidence exists.", 409);
  }
}

export function sourceCategoryCanCreateSupplier(category: SourceRegistryCategory): false {
  void category;
  return false;
}

export function assertSourceDoesNotBecomeSupplier(source: CanonicalSourceRegistryEntry): void {
  if (source.entityType !== "source") return;
  const raw = source as CanonicalSourceRegistryEntry & { supplierId?: unknown; Supplier_ID?: unknown };
  if (typeof raw.supplierId === "string" && raw.supplierId.trim()) {
    throw new MasterDataPolicyError("SOURCE_CANNOT_PROMOTE_SUPPLIER", "Source_ID must not be promoted into Supplier_ID.", 409);
  }
  if (typeof raw.Supplier_ID === "string" && raw.Supplier_ID.trim()) {
    throw new MasterDataPolicyError("SOURCE_CANNOT_PROMOTE_SUPPLIER", "Source_ID must not be promoted into Supplier_ID.", 409);
  }
  if (!source.sourceId.trim()) {
    throw new MasterDataPolicyError("SOURCE_ID_REQUIRED", "Source_ID is required for Source Registry entries.", 400);
  }
}

export type DuplicateDecision =
  | { status: "CLEAR" }
  | { status: "DUPLICATE"; reason: string; conflictingId: string }
  | { status: "REVIEW_REQUIRED"; reason: string; candidateIds: string[] };

export function detectDuplicateDecision(input: {
  draft: CanonicalMasterEntity;
  existing: CanonicalMasterEntity[];
}): DuplicateDecision {
  const canonicalId = normalizeIdentityKey(input.draft.canonicalId);
  const exact = input.existing.find((record) => normalizeIdentityKey(record.canonicalId) === canonicalId);
  if (exact) return { status: "DUPLICATE", reason: "Canonical ID already exists.", conflictingId: exact.canonicalId };

  const registration = registrationKey(input.draft);
  if (registration) {
    const registrationMatch = input.existing.find((record) => registrationKey(record) === registration);
    if (registrationMatch) {
      return { status: "DUPLICATE", reason: "Registration number already belongs to another canonical entity.", conflictingId: registrationMatch.canonicalId };
    }
  }

  const draftName = normalizeDisplayNameKey(input.draft.legalName ?? input.draft.tradingName ?? input.draft.displayName);
  if (draftName) {
    const nameMatches = input.existing.filter((record) =>
      record.entityType === input.draft.entityType &&
      normalizeDisplayNameKey(record.legalName ?? record.tradingName ?? record.displayName) === draftName,
    );
    if (nameMatches.length > 0) {
      return {
        status: "REVIEW_REQUIRED",
        reason: "Name-only match is ambiguous and cannot be auto-merged.",
        candidateIds: nameMatches.map((record) => record.canonicalId),
      };
    }
  }

  return { status: "CLEAR" };
}

export function entityCollectionName(entityType: MasterDataEntityType): string {
  return `masterData${entityType.charAt(0).toUpperCase()}${entityType.slice(1)}s`;
}

function isLowerPriorityNonOperational(provenance: MasterDataProvenance): boolean {
  return provenance === "SEED_DATA" || provenance === "DEMO_DATA" || provenance === "TEST_DATA" || provenance === "STATIC_UI_DATA" || provenance === "BENCHMARK_REFERENCE";
}

function registrationKey(entity: CanonicalMasterEntity): string {
  if (entity.entityType === "client") return normalizeIdentityKey(entity.registrationNumber);
  if (entity.entityType === "supplier") return normalizeIdentityKey(entity.registrationNumber);
  return normalizeIdentityKey(entity.externalIdentifiers.find((identifier) => /registration|cipc|business/i.test(identifier.system))?.value);
}
