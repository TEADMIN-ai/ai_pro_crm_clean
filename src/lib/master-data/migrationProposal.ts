import type { MasterDataEntityType, MasterDataMigrationProposal, MasterDataProvenance } from "@/types/masterData";

type SourceRecord = {
  source: string;
  recordReference: string;
  entityType: MasterDataEntityType;
  canonicalId?: string | null;
  legacyId?: string | null;
  provenance?: MasterDataProvenance | null;
  hasOperationalEvidence?: boolean;
  hasConflict?: boolean;
  nameOnlyMatch?: boolean;
};

export type QsSupplierMigrationRecord = {
  supplierId?: string | null;
  supplierName?: string | null;
  companyRegistrationNumber?: string | null;
  sourceType?: "canonical_match" | "source_only" | "seed_demo_test" | "conflicting" | "unknown";
  matchedMasterSupplierId?: string | null;
};

export function categoriseMasterDataMigrationRecord(record: SourceRecord): MasterDataMigrationProposal {
  if (record.hasConflict) {
    return {
      source: record.source,
      recordReference: record.recordReference,
      entityType: record.entityType,
      category: "conflicting",
      proposedCanonicalId: null,
      reason: "Conflicting identity evidence must fail closed and go to manual review.",
    };
  }

  if (record.provenance === "SEED_DATA" || record.provenance === "DEMO_DATA" || record.provenance === "TEST_DATA" || record.provenance === "STATIC_UI_DATA") {
    return {
      source: record.source,
      recordReference: record.recordReference,
      entityType: record.entityType,
      category: "seed_demo_test",
      proposedCanonicalId: null,
      reason: `${record.provenance} cannot become operational master data.`,
    };
  }

  if (record.canonicalId && record.hasOperationalEvidence) {
    return {
      source: record.source,
      recordReference: record.recordReference,
      entityType: record.entityType,
      category: "already_canonical",
      proposedCanonicalId: record.canonicalId,
      reason: "Record already carries a durable canonical ID with operational evidence.",
    };
  }

  if (record.canonicalId) {
    return {
      source: record.source,
      recordReference: record.recordReference,
      entityType: record.entityType,
      category: "safely_mappable",
      proposedCanonicalId: record.canonicalId,
      reason: "Record carries a durable ID but still requires controlled mapping validation before migration.",
    };
  }

  if (record.legacyId && !record.nameOnlyMatch) {
    return {
      source: record.source,
      recordReference: record.recordReference,
      entityType: record.entityType,
      category: "legacy_alias",
      proposedCanonicalId: null,
      reason: "Legacy identifier should be preserved as an alias rather than replacing a canonical system ID.",
    };
  }

  return {
    source: record.source,
    recordReference: record.recordReference,
    entityType: record.entityType,
    category: "review_required",
    proposedCanonicalId: null,
    reason: record.nameOnlyMatch ? "Name-only matches are ambiguous and cannot be auto-merged." : "Insufficient evidence for automatic canonical mapping.",
  };
}

export function buildPhase1MigrationProposal(records: SourceRecord[]): MasterDataMigrationProposal[] {
  return records.map(categoriseMasterDataMigrationRecord);
}


export function categoriseQsSupplierProfile(record: QsSupplierMigrationRecord): MasterDataMigrationProposal {
  const reference = record.supplierId || record.supplierName || "unknown-qs-supplier";
  if (record.sourceType === "conflicting") {
    return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "conflicting", proposedCanonicalId: null, reason: "QS supplier profile has conflicting identity evidence." };
  }
  if (record.sourceType === "seed_demo_test") {
    return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "seed_demo_test", proposedCanonicalId: null, reason: "QS supplier profile is seed/demo/test and cannot become operational truth." };
  }
  if (record.matchedMasterSupplierId || record.sourceType === "canonical_match") {
    return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "canonical_match", proposedCanonicalId: record.matchedMasterSupplierId ?? record.supplierId ?? null, reason: "QS supplier profile can map to an existing Master Supplier after verification." };
  }
  if (record.sourceType === "source_only" || (!record.companyRegistrationNumber && record.supplierName)) {
    return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "source_only", proposedCanonicalId: null, reason: "QS supplier profile is usable as a source reference only until genuine supplier identity evidence exists." };
  }
  if (record.companyRegistrationNumber) {
    return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "safely_mappable", proposedCanonicalId: record.supplierId ?? null, reason: "QS supplier profile has registration evidence but needs controlled Master Supplier verification." };
  }
  return { source: "qsSuppliers", recordReference: reference, entityType: "supplier", category: "review_required", proposedCanonicalId: null, reason: "QS supplier profile has insufficient evidence for automatic mapping." };
}

export type HygieneEvidenceMigrationCategory = "already_governed" | "storage_path_recoverable" | "legacy_signed_url_recoverable" | "relationship_review_required" | "missing_evidence" | "conflicting";

export type HygieneEvidenceMigrationRecord = {
  recordReference: string;
  storagePath?: string | null;
  fileUrl?: string | null;
  documentId?: string | null;
  hasTrustedRelationship?: boolean;
  hasConflict?: boolean;
};

export function categoriseHistoricalHygieneEvidence(record: HygieneEvidenceMigrationRecord): {
  recordReference: string;
  category: HygieneEvidenceMigrationCategory;
  proposedDocumentId: string | null;
  reason: string;
} {
  const proposedDocumentId = record.documentId ?? null;
  const hasUrl = Boolean(record.fileUrl?.trim());
  const hasStoragePath = Boolean(record.storagePath?.trim());
  const looksLikeLegacyUrl = typeof record.fileUrl === "string" && /^[a-z][a-z0-9+.-]*:\/\//i.test(record.fileUrl.trim());
  if (record.hasConflict) return { recordReference: record.recordReference, category: "conflicting", proposedDocumentId, reason: "Conflicting Hygiene evidence relationships require manual review before DocumentReference creation." };
  if (hasStoragePath && record.documentId && record.hasTrustedRelationship) return { recordReference: record.recordReference, category: "already_governed", proposedDocumentId, reason: "Evidence already has durable storage path, document identity and trusted relationship metadata." };
  if (hasStoragePath && record.hasTrustedRelationship) return { recordReference: record.recordReference, category: "storage_path_recoverable", proposedDocumentId, reason: "Durable storage path and relationship metadata can support future DocumentReference creation." };
  if (looksLikeLegacyUrl && record.hasTrustedRelationship) return { recordReference: record.recordReference, category: "legacy_signed_url_recoverable", proposedDocumentId, reason: "Legacy URL is preserved but requires storage-object recovery before governed DocumentReference migration." };
  if (hasUrl || hasStoragePath) return { recordReference: record.recordReference, category: "relationship_review_required", proposedDocumentId, reason: "Evidence reference exists but trusted collection/client/site relationship is incomplete or unverified." };
  return { recordReference: record.recordReference, category: "missing_evidence", proposedDocumentId, reason: "No historical Hygiene evidence file reference exists to migrate." };
}
