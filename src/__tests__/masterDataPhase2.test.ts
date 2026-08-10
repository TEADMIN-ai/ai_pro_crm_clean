import { AuthorizationError } from "@/lib/server/authz";
import {
  MasterDataPolicyError,
  categoriseQsSupplierProfile,
  createCanonicalMasterDataEntity,
  resolveQuoteLineItem,
  resolveSupplierForQuote,
  updateCanonicalMasterDataEntity,
  type MasterDataRepository,
} from "@/lib/master-data";
import type {
  CanonicalItem,
  CanonicalMasterEntity,
  CanonicalSupplier,
  MasterDataActor,
  MasterDataAuditEvent,
  MasterDataEntityType,
  MasterDataEvidenceReference,
} from "@/types/masterData";

const now = "2026-08-10T00:00:00.000Z";
const actor: MasterDataActor = { uid: "staff-1", role: "staff", workspaceId: "workspace-a" };
const evidencePath = "reports/teos_data_architecture/evidence/supplier-quotes/2026/SQ-2026-JCE-3744/original/Quote_3744_JC_Enterprise.pdf";

class MemoryMasterDataRepository implements MasterDataRepository {
  records: CanonicalMasterEntity[];
  audits: MasterDataAuditEvent[] = [];

  constructor(seed: CanonicalMasterEntity[] = []) {
    this.records = [...seed];
  }

  async getByCanonicalId(entityType: MasterDataEntityType, canonicalId: string) {
    return this.records.find((record) => record.entityType === entityType && record.canonicalId === canonicalId) ?? null;
  }

  async listByEntityType(entityType: MasterDataEntityType, workspaceId: string) {
    return this.records.filter((record) => record.entityType === entityType && record.workspaceId === workspaceId);
  }

  async save(entity: CanonicalMasterEntity) {
    const index = this.records.findIndex((record) => record.entityType === entity.entityType && record.canonicalId === entity.canonicalId);
    if (index >= 0) this.records[index] = entity;
    else this.records.push(entity);
  }

  async writeAuditEvent(event: MasterDataAuditEvent) {
    this.audits.push(event);
  }

  async lookupIdentity(entityType: "supplier", workspaceId: string, lookup: {
    canonicalId?: string | null;
    registrationNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    legalName?: string | null;
    tradingName?: string | null;
  }) {
    const clean = (value: string | null | undefined) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const nameKeys = [clean(lookup.legalName), clean(lookup.tradingName)].filter(Boolean);
    return this.records.filter((record) => {
      if (record.entityType !== entityType || record.workspaceId !== workspaceId) return false;
      const supplier = record as CanonicalSupplier;
      return Boolean(
        (lookup.canonicalId && supplier.supplierId === lookup.canonicalId) ||
        (lookup.registrationNumber && supplier.registrationNumber === lookup.registrationNumber) ||
        (lookup.email && supplier.email === lookup.email) ||
        (lookup.phone && supplier.phone === lookup.phone) ||
        nameKeys.includes(clean(supplier.legalName)) ||
        nameKeys.includes(clean(supplier.tradingName)) ||
        nameKeys.includes(clean(supplier.displayName)),
      );
    });
  }
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
    sourceEvidence: [{ sourcePath: evidencePath }],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    registrationNumber: "2021/628179/07",
    vatNumber: null,
    contactPerson: null,
    email: null,
    phone: null,
    address: null,
    regionCoverage: ["Gauteng"],
    paymentTerms: null,
    linkedSourceId: null,
    identityEvidence: [{ sourcePath: evidencePath }],
    documentIds: [],
    ...overrides,
  };
}

function item(overrides: Partial<CanonicalItem> = {}): CanonicalItem {
  return {
    entityType: "item",
    canonicalId: "TE-HYG-BIN-WHL-240-ORG-001",
    itemId: "TE-HYG-BIN-WHL-240-ORG-001",
    itemCode: "TE-HYG-BIN-WHL-240-ORG-001",
    displayName: "240L Orange wheelie bin with waste sticker",
    legalName: null,
    tradingName: null,
    externalIdentifiers: [],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "SYSTEM_CANONICAL",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    description: "240L Orange wheelie bin with waste sticker",
    category: "Hygiene bins",
    division: "Hygiene",
    unit: "each",
    packSize: null,
    conversionFactor: null,
    supplierSku: null,
    sourceIds: [],
    priceReferenceIds: [],
    ...overrides,
  };
}

function jceEvidence(): MasterDataEvidenceReference[] {
  return [{
    sourcePath: evidencePath,
    filename: "Quote_3744_JC_Enterprise.pdf",
    issueDate: "2026-07-16",
    expiryDate: "2026-07-23",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
  }];
}

describe("TEOS Master Data Foundation Phase 2", () => {
  test("authenticated privileged Master Data create persists entity and audit", async () => {
    const repository = new MemoryMasterDataRepository();
    const result = await createCanonicalMasterDataEntity({ actor, repository, entity: supplier(), reason: "phase 2 create", now });
    expect(result.entity.canonicalId).toBe("TE-SUP-JCE-2021-628179-07");
    expect(repository.records).toHaveLength(1);
    expect(repository.audits[0]).toMatchObject({ action: "create", entityType: "supplier", actorUid: "staff-1" });
  });

  test("unauthorized create and cross-workspace create are blocked", async () => {
    await expect(createCanonicalMasterDataEntity({
      actor: { uid: "viewer-1", role: "viewer", workspaceId: "workspace-a" },
      repository: new MemoryMasterDataRepository(),
      entity: supplier(),
      reason: "viewer create",
      now,
    })).rejects.toBeInstanceOf(AuthorizationError);

    await expect(createCanonicalMasterDataEntity({
      actor: { uid: "staff-1", role: "staff", workspaceId: "workspace-b" },
      repository: new MemoryMasterDataRepository(),
      entity: supplier(),
      reason: "cross workspace",
      now,
    })).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("duplicate canonical ID and duplicate registration number are rejected", async () => {
    const repository = new MemoryMasterDataRepository([supplier()]);
    await expect(createCanonicalMasterDataEntity({ actor, repository, entity: supplier(), reason: "duplicate id", now }))
      .rejects.toMatchObject({ code: "CANONICAL_ID_DUPLICATE" });

    await expect(createCanonicalMasterDataEntity({
      actor,
      repository,
      entity: supplier({ canonicalId: "TE-SUP-OTHER-2021-628179-07", supplierId: "TE-SUP-OTHER-2021-628179-07", displayName: "Other Supplier" }),
      reason: "duplicate registration",
      now,
    })).rejects.toMatchObject({ code: "DUPLICATE_IDENTITY_BLOCKED" });
  });

  test("benchmark Source_ID cannot become Supplier_ID and source-only quote can remain unresolved", async () => {
    const result = await resolveSupplierForQuote({
      actor,
      repository: new MemoryMasterDataRepository(),
      supplier: {
        workspaceId: "workspace-a",
        supplierName: "Stats SA CPI Index",
        sourceId: "SRC-STATS-SA-CPI",
        sourceCategory: "benchmark_source",
      },
      now,
    });
    expect(result).toMatchObject({
      status: "SOURCE_ONLY",
      supplierId: null,
      sourceId: "SRC-STATS-SA-CPI",
      reviewStatus: "REVIEW_REQUIRED",
    });
  });

  test("verified supplier can be reused by quote intake", async () => {
    const repository = new MemoryMasterDataRepository([supplier({ verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" })]);
    const result = await resolveSupplierForQuote({
      actor,
      repository,
      supplier: {
        workspaceId: "workspace-a",
        supplierName: "JC Enterprise / J Centre P",
        registrationNumber: "2021/628179/07",
        evidenceReferences: jceEvidence(),
        quoteId: "SQ-2026-JCE-3744",
      },
      now,
    });
    expect(result).toMatchObject({
      status: "RESOLVED_VERIFIED",
      supplierId: "TE-SUP-JCE-2021-628179-07",
      verificationStatus: "VERIFIED",
    });
  });

  test("ambiguous supplier match fails closed", async () => {
    const repository = new MemoryMasterDataRepository([
      supplier({ canonicalId: "TE-SUP-JCE-A", supplierId: "TE-SUP-JCE-A", registrationNumber: "2021/628179/07" }),
      supplier({ canonicalId: "TE-SUP-JCE-B", supplierId: "TE-SUP-JCE-B", registrationNumber: "2021/628179/07" }),
    ]);
    const result = await resolveSupplierForQuote({
      actor,
      repository,
      supplier: { workspaceId: "workspace-a", supplierName: "JC Enterprise / J Centre P", registrationNumber: "2021/628179/07", evidenceReferences: jceEvidence() },
      now,
    });
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED", supplierId: null });
  });

  test("JC Enterprise historical quote evidence creates a pending canonical supplier candidate", async () => {
    const repository = new MemoryMasterDataRepository();
    const result = await resolveSupplierForQuote({
      actor,
      repository,
      supplier: {
        workspaceId: "workspace-a",
        supplierId: "TE-SUP-JCE-2021-628179-07",
        supplierName: "JC Enterprise / J Centre P",
        registrationNumber: "2021/628179/07",
        regionCoverage: ["Gauteng"],
        evidenceReferences: jceEvidence(),
        quoteId: "SQ-2026-JCE-3744",
      },
      now,
    });
    expect(result).toMatchObject({
      status: "CREATED_PENDING_REVIEW",
      supplierId: "TE-SUP-JCE-2021-628179-07",
      verificationStatus: "PENDING_REVIEW",
    });
    expect(result.evidenceReferences[0].sourcePath).toBe(evidencePath);
    expect(repository.audits[0]).toMatchObject({ action: "create", entityId: "TE-SUP-JCE-2021-628179-07" });
  });

  test("direct QS supplier-profile bypass is gated when supplier remains source-only", async () => {
    const result = await resolveSupplierForQuote({
      actor,
      repository: new MemoryMasterDataRepository(),
      supplier: { workspaceId: "workspace-a", supplierName: "Market benchmark source", sourceCategory: "market_intelligence_source" },
      now,
    });
    expect(result.supplierId).toBeNull();
    expect(result.status).toBe("SOURCE_ONLY");
  });

  test("exact Item_ID quote-line match succeeds and description-only match requires review", async () => {
    const repository = new MemoryMasterDataRepository([item()]);
    await expect(resolveQuoteLineItem({
      repository,
      line: { workspaceId: "workspace-a", itemId: "TE-HYG-BIN-WHL-240-ORG-001", description: "orange bin" },
    })).resolves.toMatchObject({ status: "RESOLVED", itemId: "TE-HYG-BIN-WHL-240-ORG-001" });

    await expect(resolveQuoteLineItem({
      repository,
      line: { workspaceId: "workspace-a", description: "240L orange wheelie bin" },
    })).resolves.toMatchObject({ status: "REVIEW_REQUIRED", itemId: null });
  });

  test("cross-workspace Item_ID quote-line match is blocked", async () => {
    const repository = new MemoryMasterDataRepository([item({ workspaceId: "workspace-b" })]);
    await expect(resolveQuoteLineItem({
      repository,
      line: { workspaceId: "workspace-a", reviewerApprovedItemId: "TE-HYG-BIN-WHL-240-ORG-001" },
    })).resolves.toMatchObject({ status: "BLOCKED", itemId: null });
  });

  test("archive updates status without deleting history and emits audit", async () => {
    const repository = new MemoryMasterDataRepository([supplier({ verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" })]);
    const result = await updateCanonicalMasterDataEntity({
      actor,
      repository,
      entityType: "supplier",
      canonicalId: "TE-SUP-JCE-2021-628179-07",
      patch: { status: "archived", verificationStatus: "ARCHIVED", reviewStatus: "ARCHIVED" },
      reason: "archive test",
      now,
    });
    expect(repository.records).toHaveLength(1);
    expect(result.entity.status).toBe("archived");
    expect(repository.audits[0]).toMatchObject({ action: "archive", previousState: expect.any(Object), resultingState: expect.any(Object) });
  });

  test("migration proposal categorises QS supplier profiles for later migration", () => {
    expect(categoriseQsSupplierProfile({ supplierId: "TE-SUP-JCE-2021-628179-07", matchedMasterSupplierId: "TE-SUP-JCE-2021-628179-07" }).category).toBe("canonical_match");
    expect(categoriseQsSupplierProfile({ supplierName: "Index Source" }).category).toBe("source_only");
    expect(categoriseQsSupplierProfile({ supplierName: "Conflicted", sourceType: "conflicting" }).category).toBe("conflicting");
  });

  test("malformed Master Data state is rejected", async () => {
    await expect(createCanonicalMasterDataEntity({
      actor,
      repository: new MemoryMasterDataRepository(),
      entity: supplier({ provenance: "BENCHMARK_REFERENCE", verificationStatus: "VERIFIED" }),
      reason: "bad promotion",
      now,
    })).rejects.toBeInstanceOf(MasterDataPolicyError);
  });
});
