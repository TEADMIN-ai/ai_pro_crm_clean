import { buildContractorSelectorOption } from "@/lib/contractors/contractorSelectorOptions";
import { resolveRepairOperation } from "@/lib/maintenance/dependencyResolver";
import type { BrokenReferenceIssue } from "@/lib/maintenance/repairStrategies";
import { matchContractorsForOpportunity } from "@/lib/opportunities/opportunityExecution";

function issue(overrides: Partial<BrokenReferenceIssue> = {}): BrokenReferenceIssue {
  return {
    issueId: "issue-1",
    collection: "users",
    documentId: "user-1",
    sourcePath: "users/user-1",
    referenceField: "contractorId",
    expectedTarget: "contractors/contractor-1",
    missingTarget: "contractors/contractor-1",
    relationshipType: "user-contractor",
    rootCause: "missing target",
    severity: "High",
    repairStrategy: "RESTORE TARGET",
    repairExplanation: "restore missing contractor",
    ...overrides,
  };
}

function dbWithSource(sourceData: Record<string, unknown>, queryDocs: string[] = []) {
  return {
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ exists: true, data: () => sourceData }),
    })),
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: queryDocs.map((id) => ({ id })) }),
        })),
      })),
    })),
  } as any;
}

describe("dependencyResolver contractor identity recovery", () => {
  it("restores personal-name source as unresolved without companyName", async () => {
    const operation = await resolveRepairOperation(dbWithSource({
      name: "Mr K",
      email: "mr.k@example.com",
    }), issue());

    expect(operation.type).toBe("restore-target");
    expect(operation.updateData).toEqual(expect.objectContaining({
      contractorId: "contractor-1",
      identityResolved: false,
      identityStatus: "UNRESOLVED",
      businessIdentityEvidenceStatus: "MISSING",
      workspaceId: null,
      workspaceResolutionStatus: "UNRESOLVED",
      integrityRepairStrategy: "RESTORE_UNRESOLVED_IDENTITY",
    }));
    expect(operation.updateData).not.toHaveProperty("companyName");
    expect(operation.updateData).not.toHaveProperty("name");
  });

  it("does not promote email or document id into business identity", async () => {
    const operation = await resolveRepairOperation(dbWithSource({
      companyName: "contractor-1",
      email: "contractor-1@example.com",
    }), issue());

    expect(operation.updateData?.identityResolved).toBe(false);
    expect(operation.updateData).not.toHaveProperty("companyName");
    expect(JSON.stringify(operation.updateData)).not.toContain("Unnamed Contractor");
  });

  it("preserves verified legal and trading identity evidence", async () => {
    const operation = await resolveRepairOperation(dbWithSource({
      legalName: "Empire Civil Pty Ltd",
      tradingName: "Empire Civil",
      workspaceId: "workspace-a",
    }), issue());

    expect(operation.updateData).toEqual(expect.objectContaining({
      legalName: "Empire Civil Pty Ltd",
      tradingName: "Empire Civil",
      companyName: "Empire Civil Pty Ltd",
      identityResolved: true,
      identityStatus: "VERIFIED",
      workspaceId: "workspace-a",
    }));
  });

  it("fails conflicting evidence closed into unresolved repair", async () => {
    const operation = await resolveRepairOperation(dbWithSource({
      legalName: "Empire Civil Pty Ltd",
      companyName: "Different Supplier Pty Ltd",
    }), issue());

    expect(operation.updateData?.identityResolved).toBe(false);
    expect(operation.updateData?.blockingReasons).toEqual(expect.arrayContaining([
      "Contractor business identity evidence is conflicting",
    ]));
  });

  it("repeated recovery is deterministic for identity fields", async () => {
    const source = { name: "Mr K", email: "mr.k@example.com" };
    const first = await resolveRepairOperation(dbWithSource(source), issue());
    const second = await resolveRepairOperation(dbWithSource(source), issue());

    expect(first.updateData?.identityResolved).toBe(second.updateData?.identityResolved);
    expect(first.updateData?.identityStatus).toBe(second.updateData?.identityStatus);
    expect(first.updateData?.blockingReasons).toEqual(second.updateData?.blockingReasons);
  });

  it("recovered unresolved records remain excluded from selector and blocked from matching", async () => {
    const operation = await resolveRepairOperation(dbWithSource({
      name: "Mr K",
      workspaceId: "workspace-a",
    }), issue());

    expect(buildContractorSelectorOption(operation.updateData ?? {})).toBeNull();
    const [match] = matchContractorsForOpportunity({
      deal: { id: "deal-1", workspaceId: "workspace-a", requirementsReview: { reviewed: true, taxRequirement: false, csdRequirement: false, bbbeeRequirement: false, coidaRequirement: false, bankingRequirement: false, compulsoryReturnables: [] } },
      contractors: [{ id: "contractor-1", ...(operation.updateData ?? {}) }],
    });
    expect(match.assignmentAllowed).toBe(false);
    expect(match.blockingReasons).toContain("Contractor identity is unresolved");
  });
});
