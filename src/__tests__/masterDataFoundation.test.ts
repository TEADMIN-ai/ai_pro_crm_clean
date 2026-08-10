import { AuthorizationError } from "@/lib/server/authz";
import {
  MasterDataPolicyError,
  assertItemIdentitySeparateFromPricing,
  buildPhase1MigrationProposal,
  createCanonicalMasterDataEntity,
  resolveHygieneClientReference,
  resolveHygieneSiteReference,
  resolveOpportunityClientReference,
  sourceCategoryCanCreateSupplier,
  supplierProfileRequiresMasterDataReview,
  type MasterDataRepository,
} from "@/lib/master-data";
import type { Deal } from "@/types/deal";
import type { HygieneClient, HygieneSite } from "@/types/hygiene";
import type { Material, QSSupplierProfile } from "@/types/qs";
import type { CanonicalClient, CanonicalMasterEntity, CanonicalSupplier, MasterDataActor } from "@/types/masterData";

const actor: MasterDataActor = { uid: "staff-1", role: "staff", workspaceId: "workspace-a" };

function repo(seed: CanonicalMasterEntity[] = []): MasterDataRepository & { records: CanonicalMasterEntity[] } {
  const records = [...seed];
  return {
    records,
    async getByCanonicalId(entityType, canonicalId) {
      return records.find((record) => record.entityType === entityType && record.canonicalId === canonicalId) ?? null;
    },
    async listByEntityType(entityType, workspaceId) {
      return records.filter((record) => record.entityType === entityType && record.workspaceId === workspaceId);
    },
    async save(entity) {
      const index = records.findIndex((record) => record.entityType === entity.entityType && record.canonicalId === entity.canonicalId);
      if (index >= 0) records[index] = entity;
      else records.push(entity);
    },
    async writeAuditEvent() {
      return;
    },
  };
}

function client(overrides: Partial<CanonicalClient> = {}): CanonicalClient {
  return {
    entityType: "client",
    canonicalId: "TE-CLI-1",
    displayName: "Real Client",
    legalName: "Real Client Pty Ltd",
    tradingName: "Real Client",
    externalIdentifiers: [],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "USER_CONFIRMED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [],
    notes: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    createdBy: "staff-1",
    updatedBy: "staff-1",
    registrationNumber: null,
    contactDetails: {},
    billingDetails: {},
    industrySector: null,
    relatedSiteIds: [],
    relatedOpportunityIds: [],
    relatedProjectIds: [],
    documentIds: [],
    ...overrides,
  };
}

function supplier(overrides: Partial<CanonicalSupplier> = {}): CanonicalSupplier {
  return {
    entityType: "supplier",
    canonicalId: "TE-SUP-JCE-2021-628179-07",
    supplierId: "TE-SUP-JCE-2021-628179-07",
    displayName: "JC Enterprise / J Centre P",
    legalName: "JC Enterprise / J Centre P",
    tradingName: "J Centre P",
    externalIdentifiers: [{ system: "business_registration", value: "2021/628179/07", status: "active" }],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [{ sourcePath: "reports/teos_data_architecture/evidence/supplier-quotes/2026/SQ-2026-JCE-3744/original/Quote_3744_JC_Enterprise.pdf" }],
    notes: null,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    createdBy: "staff-1",
    updatedBy: "staff-1",
    registrationNumber: "2021/628179/07",
    vatNumber: null,
    contactPerson: null,
    email: null,
    phone: "+27720481645",
    address: null,
    regionCoverage: ["Gauteng"],
    paymentTerms: null,
    linkedSourceId: null,
    identityEvidence: [{ sourcePath: "reports/teos_data_architecture/evidence/supplier-quotes/2026/SQ-2026-JCE-3744/original/Quote_3744_JC_Enterprise.pdf" }],
    documentIds: [],
    ...overrides,
  };
}

describe("TEOS Master Data Foundation Phase 1", () => {
  test("canonical entity creation validates server authority", async () => {
    const store = repo();
    const result = await createCanonicalMasterDataEntity({ actor, repository: store, entity: client(), reason: "phase 1 test" });
    expect(result.entity.canonicalId).toBe("TE-CLI-1");
    expect(result.auditEvent.action).toBe("create");
  });

  test("duplicate canonical IDs are rejected", async () => {
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo([client()]), entity: client(), reason: "duplicate" })).rejects.toMatchObject({ code: "CANONICAL_ID_DUPLICATE" });
  });

  test("ambiguous duplicate names are not auto-merged", async () => {
    const draft = client({ canonicalId: "TE-CLI-2" });
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo([client()]), entity: draft, reason: "name duplicate" })).rejects.toMatchObject({ code: "POSSIBLE_DUPLICATE_REVIEW_REQUIRED" });
  });

  test("SEED_DATA cannot silently become VERIFIED", async () => {
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo(), entity: client({ provenance: "SEED_DATA", verificationStatus: "VERIFIED" }), reason: "bad promotion" })).rejects.toMatchObject({ code: "LOW_PRIORITY_DATA_CANNOT_VERIFY" });
  });

  test("benchmark Source_ID cannot silently become Supplier_ID", () => {
    expect(sourceCategoryCanCreateSupplier("benchmark_source")).toBe(false);
  });

  test("unresolved supplier identity remains pending", async () => {
    const item = supplier({ registrationNumber: null, externalIdentifiers: [], identityEvidence: [], sourceEvidence: [], verificationStatus: "PENDING_REVIEW" });
    const result = await createCanonicalMasterDataEntity({ actor, repository: repo(), entity: item, reason: "unresolved supplier" });
    expect(result.entity).toMatchObject({ verificationStatus: "PENDING_REVIEW", reviewStatus: "REVIEW_REQUIRED" });
  });

  test("verified supplier requires identity evidence", async () => {
    const item = supplier({ registrationNumber: null, externalIdentifiers: [], identityEvidence: [], sourceEvidence: [], verificationStatus: "VERIFIED" });
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo(), entity: item, reason: "verified without evidence" })).rejects.toMatchObject({ code: "SUPPLIER_IDENTITY_EVIDENCE_REQUIRED" });
  });

  test("Item identity remains separate from Item pricing", () => {
    const material: Material = { materialId: "TE-WAT-GLS-STL-250-001", name: "Still water 250ml", categoryId: "water", unit: "each", vatApplicable: true, status: "active", createdAt: "2026-08-10", updatedAt: "2026-08-10" };
    expect(assertItemIdentitySeparateFromPricing({ item: material, supplierPrices: [{ supplierPriceId: "SP-1", supplierId: "SUP-1", materialId: material.materialId, province: "Gauteng", price: 10, currency: "ZAR", unit: "each", effectiveDate: "2026-08-10", source: "quote", status: "active", createdAt: "2026-08-10", updatedAt: "2026-08-10" }] })).toBe(true);
  });

  test("client and site read adapters preserve canonical IDs", () => {
    const hygieneClient: HygieneClient = { clientId: "TE-CLI-1", clientName: "Real Client", clientType: "Hygiene", companyRegistration: "REG", primaryContactName: "Ops", primaryContactPhone: "1", primaryContactEmail: "ops@example.invalid", billingContact: "Ops", contractStartDate: "2026-01-01", contractEndDate: "2026-12-31", serviceFrequency: "Weekly", collectionDay: "Friday", collectionWindow: "After 13:00", paymentStatus: "Paid", status: "Active", monthlyRevenue: 1, recordClassification: "PRODUCTION", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const site: HygieneSite = { siteId: "TE-SIT-1", clientId: "TE-CLI-1", siteName: "Main Site", address: "1 Street", suburb: "Town", city: "City", contactPerson: "Ops", contactPhone: "1", binCount: 1, binSize: "12L", serviceFrequency: "Weekly", accessNotes: "Gate", lastServiceDate: null, nextServiceDate: null, status: "Active" };
    expect(resolveHygieneClientReference(hygieneClient)).toMatchObject({ status: "RESOLVED", canonicalId: "TE-CLI-1" });
    expect(resolveHygieneSiteReference(site)).toMatchObject({ status: "RESOLVED", canonicalId: "TE-SIT-1" });
  });

  test("unauthorised writes are blocked", async () => {
    await expect(createCanonicalMasterDataEntity({ actor: { uid: "viewer-1", role: "viewer", workspaceId: "workspace-a" }, repository: repo(), entity: client(), reason: "viewer" })).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("cross-workspace writes are blocked", async () => {
    await expect(createCanonicalMasterDataEntity({ actor: { uid: "staff-1", role: "staff", workspaceId: "workspace-b" }, repository: repo(), entity: client(), reason: "cross workspace" })).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("malformed provenance and verification states are rejected", async () => {
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo(), entity: client({ provenance: "BAD" as never }), reason: "bad provenance" })).rejects.toBeInstanceOf(MasterDataPolicyError);
    await expect(createCanonicalMasterDataEntity({ actor, repository: repo(), entity: client({ verificationStatus: "DONE" as never }), reason: "bad verification" })).rejects.toBeInstanceOf(MasterDataPolicyError);
  });

  test("opportunity client names require review without Client_ID", () => {
    const deal = { id: "deal-1", title: "RFQ", companyId: "company", stage: "lead", clientName: "Name Only Client" } as Deal & Record<string, unknown>;
    expect(resolveOpportunityClientReference(deal)).toMatchObject({ status: "REVIEW_REQUIRED", canonicalId: null });
    expect(resolveOpportunityClientReference({ ...deal, Client_ID: "TE-CLI-1" })).toMatchObject({ status: "RESOLVED", canonicalId: "TE-CLI-1" });
  });

  test("QS supplier profiles require Master Data review", () => {
    const profile = { supplierId: "qs-sup-1", supplierName: "Supplier A", companyRegistrationNumber: null } as QSSupplierProfile;
    expect(supplierProfileRequiresMasterDataReview(profile)).toMatchObject({ status: "UNRESOLVED", verificationStatus: "PENDING_REVIEW" });
  });

  test("migration proposal categorises records without executing migration", () => {
    const proposal = buildPhase1MigrationProposal([
      { source: "v3", recordReference: "TE-WAT-1", entityType: "item", canonicalId: "TE-WAT-1", hasOperationalEvidence: false },
      { source: "seed", recordReference: "demo", entityType: "supplier", provenance: "SEED_DATA" },
      { source: "legacy", recordReference: "name", entityType: "client", nameOnlyMatch: true },
    ]);
    expect(proposal.map((item) => item.category)).toEqual(["safely_mappable", "seed_demo_test", "review_required"]);
  });
});
