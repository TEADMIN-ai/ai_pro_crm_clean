import type { UserRole } from "@/lib/auth/roleUtils";

export type MasterDataProvenance =
  | "OPERATIONAL_VERIFIED"
  | "SYSTEM_CANONICAL"
  | "USER_CONFIRMED"
  | "BENCHMARK_REFERENCE"
  | "SEED_DATA"
  | "DEMO_DATA"
  | "TEST_DATA"
  | "STATIC_UI_DATA"
  | "UNKNOWN_PROVENANCE";

export type MasterDataVerificationStatus = "PENDING_REVIEW" | "VERIFIED" | "REJECTED" | "ARCHIVED";
export type MasterDataReviewStatus = "READY_FOR_USE" | "REVIEW_REQUIRED" | "BLOCKED" | "ARCHIVED";
export type MasterDataRecordStatus = "active" | "archived";

export type MasterDataEvidenceStatus =
  | "PRESENT"
  | "MISSING"
  | "EXPIRED"
  | "REJECTED"
  | "HISTORICAL_ONLY"
  | "PENDING_REVIEW"
  | "VERIFIED";

export type MasterDataEvidencePurpose =
  | "SUPPLIER_IDENTITY"
  | "CURRENT_QS_PRICING"
  | "HISTORICAL_PRICE"
  | "SUPPLIER_QUOTE_REVIEW"
  | "CONTRACTOR_COMPLIANCE"
  | "HYGIENE_COLLECTION_ACKNOWLEDGEMENT"
  | "HYGIENE_DISPOSAL_PROOF"
  | "FINANCE_TRANSACTION_SUPPORT"
  | "RFQ_SOURCE"
  | "GENERAL_REFERENCE";

export type MasterDataLinkedBusinessReference = {
  referenceType: string;
  referenceId: string;
  relationship: string;
};

export type MasterDataEntityType =
  | "client"
  | "contractor"
  | "supplier"
  | "site"
  | "employee"
  | "item"
  | "source"
  | "document";

export type SourceRegistryCategory =
  | "supplier_pricing_source"
  | "catalogue_source"
  | "benchmark_source"
  | "statistical_index_source"
  | "market_intelligence_source"
  | "process_software_source";

export type MasterDataAuditAction =
  | "create"
  | "update"
  | "archive"
  | "verification"
  | "rejection"
  | "duplicate_resolution"
  | "alias_linkage"
  | "evidence_access"
  | "evidence_review"
  | "evidence_historical_only";

export type MasterDataActor = {
  uid: string;
  role: UserRole;
  email?: string | null;
  workspaceId?: string | null;
};

export type MasterDataEvidenceReference = {
  documentId?: string | null;
  sourcePath?: string | null;
  storagePath?: string | null;
  filename?: string | null;
  hash?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  verificationStatus?: MasterDataVerificationStatus;
  provenance?: MasterDataProvenance;
  evidenceStatus?: MasterDataEvidenceStatus;
  evidencePurposes?: MasterDataEvidencePurpose[];
};

export type MasterDataExternalIdentifier = {
  system: string;
  value: string;
  status?: "active" | "legacy" | "alias" | "rejected";
};

export type CanonicalMasterEntityBase = {
  entityType: MasterDataEntityType;
  canonicalId: string;
  displayName: string;
  legalName?: string | null;
  tradingName?: string | null;
  externalIdentifiers: MasterDataExternalIdentifier[];
  workspaceId: string;
  organisationId?: string | null;
  status: MasterDataRecordStatus;
  provenance: MasterDataProvenance;
  verificationStatus: MasterDataVerificationStatus;
  reviewStatus: MasterDataReviewStatus;
  sourceEvidence: MasterDataEvidenceReference[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type CanonicalClient = CanonicalMasterEntityBase & {
  entityType: "client";
  registrationNumber?: string | null;
  contactDetails?: {
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  billingDetails?: Record<string, unknown>;
  industrySector?: string | null;
  relatedSiteIds: string[];
  relatedOpportunityIds: string[];
  relatedProjectIds: string[];
  documentIds: string[];
};

export type CanonicalContractorReference = CanonicalMasterEntityBase & {
  entityType: "contractor";
  contractorId: string;
  workspaceAuthority: "existing_contractor_authority";
  legacyAliases: string[];
  complianceDocumentIds: string[];
};

export type CanonicalSupplier = CanonicalMasterEntityBase & {
  entityType: "supplier";
  supplierId: string;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  regionCoverage: string[];
  paymentTerms?: string | null;
  linkedSourceId?: string | null;
  identityEvidence: MasterDataEvidenceReference[];
  documentIds: string[];
};

export type CanonicalSite = CanonicalMasterEntityBase & {
  entityType: "site";
  siteId: string;
  clientId: string;
  physicalAddress?: string | null;
  gps?: { latitude: number; longitude: number } | null;
  operationalDivision?: string | null;
  contactPerson?: string | null;
  serviceProjectStatus?: string | null;
};

export type CanonicalEmployeeReference = CanonicalMasterEntityBase & {
  entityType: "employee";
  employeeId: string;
  authUserId: string;
  businessDisplayName: string;
  role: UserRole;
};

export type CanonicalItem = CanonicalMasterEntityBase & {
  entityType: "item";
  itemId: string;
  itemCode: string;
  description: string;
  category?: string | null;
  division?: string | null;
  unit: string;
  packSize?: string | number | null;
  conversionFactor?: number | null;
  supplierSku?: string | null;
  sourceIds: string[];
  priceReferenceIds: string[];
};

export type CanonicalSourceRegistryEntry = CanonicalMasterEntityBase & {
  entityType: "source";
  sourceId: string;
  category: SourceRegistryCategory;
  sourceName: string;
  sourceUrl?: string | null;
};

export type CanonicalDocumentReference = CanonicalMasterEntityBase & {
  entityType: "document";
  documentId: string;
  documentType: string;
  linkedEntityType: MasterDataEntityType;
  linkedEntityId: string;
  sourcePath?: string | null;
  storagePath?: string | null;
  filename?: string | null;
  contentType?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  documentDate?: string | null;
  evidenceStatus?: MasterDataEvidenceStatus;
  evidencePurposes?: MasterDataEvidencePurpose[];
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  hash?: string | null;
  sourceSystem?: string | null;
  linkedBusinessReferences?: MasterDataLinkedBusinessReference[];
};

export type CanonicalMasterEntity =
  | CanonicalClient
  | CanonicalContractorReference
  | CanonicalSupplier
  | CanonicalSite
  | CanonicalEmployeeReference
  | CanonicalItem
  | CanonicalSourceRegistryEntry
  | CanonicalDocumentReference;

export type MasterDataAuditEvent = {
  eventId: string;
  action: MasterDataAuditAction;
  actorUid: string;
  actorRole: UserRole;
  workspaceId: string;
  entityType: MasterDataEntityType;
  entityId: string;
  previousState?: CanonicalMasterEntity | null;
  resultingState?: CanonicalMasterEntity | null;
  reason: string;
  evidenceReferences: MasterDataEvidenceReference[];
  createdAt: string;
};

export type CanonicalReferenceResolution = {
  status: "RESOLVED" | "REVIEW_REQUIRED" | "UNRESOLVED" | "BLOCKED";
  entityType: MasterDataEntityType;
  canonicalId: string | null;
  sourceReference: string | null;
  reason: string;
  provenance: MasterDataProvenance;
  verificationStatus: MasterDataVerificationStatus;
};

export type SupplierResolutionStatus =
  | "RESOLVED_VERIFIED"
  | "CREATED_PENDING_REVIEW"
  | "REVIEW_REQUIRED"
  | "SOURCE_ONLY"
  | "BLOCKED";

export type SupplierResolutionResult = {
  status: SupplierResolutionStatus;
  supplierId: string | null;
  sourceId: string | null;
  supplierName: string | null;
  reviewStatus: MasterDataReviewStatus;
  verificationStatus: MasterDataVerificationStatus;
  reason: string;
  evidenceReferences: MasterDataEvidenceReference[];
};

export type ItemResolutionStatus = "RESOLVED" | "REVIEW_REQUIRED" | "UNRESOLVED" | "BLOCKED";

export type ItemResolutionResult = {
  status: ItemResolutionStatus;
  itemId: string | null;
  sourceReference: string | null;
  reason: string;
};

export type MigrationCategory =
  | "already_canonical"
  | "safely_mappable"
  | "canonical_match"
  | "source_only"
  | "review_required"
  | "seed_demo_test"
  | "legacy_alias"
  | "conflicting";

export type MasterDataMigrationProposal = {
  source: string;
  recordReference: string;
  entityType: MasterDataEntityType;
  category: MigrationCategory;
  proposedCanonicalId?: string | null;
  reason: string;
};
