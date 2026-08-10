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
