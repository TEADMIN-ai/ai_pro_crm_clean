import {
  classifyContractorRecord,
  isContractorVisibleToWorkspace,
} from "@/lib/contractors/contractorVisibility";

const context = { workspaceId: "workspace-a", actorRole: "staff" };

describe("contractor visibility policy", () => {
  it("shows current-workspace production contractors", () => {
    expect(isContractorVisibleToWorkspace({ id: "c1", workspaceId: "workspace-a" }, context).visible).toBe(true);
  });

  it("excludes cross-workspace contractors", () => {
    const decision = isContractorVisibleToWorkspace({ id: "c1", workspaceId: "workspace-b" }, context);
    expect(decision).toMatchObject({ visible: false, reason: "cross_workspace" });
  });

  it.each([
    [{ qa: true }, "QA"],
    [{ safeToDelete: true }, "QA"],
    [{ qaNamespace: "v1" }, "QA"],
    [{ demo: true }, "DEMO"],
    [{ demoContractor: true }, "DEMO"],
    [{ benchmark: true }, "BENCHMARK"],
    [{ benchmarkContractor: true }, "BENCHMARK"],
    [{ canonical: true }, "BENCHMARK"],
    [{ canonicalProfile: true }, "BENCHMARK"],
    [{ archived: true }, "ARCHIVED"],
    [{ archivedAt: "2026-07-01T00:00:00.000Z" }, "ARCHIVED"],
    [{ status: "archived" }, "ARCHIVED"],
    [{ recordClassification: "TEST" }, "TEST"],
  ])("excludes explicit non-production or archived metadata %#", (metadata, classification) => {
    const record = { id: "c1", workspaceId: "workspace-a", ...metadata };
    expect(classifyContractorRecord(record)).toBe(classification);
    expect(isContractorVisibleToWorkspace(record, context).visible).toBe(false);
  });

  it("does not exclude production names containing Test without metadata", () => {
    const record = { id: "c1", workspaceId: "workspace-a", companyName: "Test Valley Electrical" };
    expect(classifyContractorRecord(record)).toBe("PRODUCTION");
    expect(isContractorVisibleToWorkspace(record, context).visible).toBe(true);
  });

  it("does not globally expose missing-workspace legacy records", () => {
    const decision = isContractorVisibleToWorkspace({ id: "legacy", companyName: "Legacy Contractor" }, context);
    expect(decision).toMatchObject({ visible: false, classification: "LEGACY_UNASSIGNED" });
  });

  it("allows explicit admin legacy review mode", () => {
    const decision = isContractorVisibleToWorkspace(
      { id: "legacy", companyName: "Legacy Contractor" },
      { workspaceId: "workspace-a", actorRole: "admin", includeLegacyUnassigned: true },
    );
    expect(decision.visible).toBe(true);
  });

  it("derives classification deterministically", () => {
    const record = { id: "c1", workspaceId: "workspace-a", qa: true, archived: true };
    expect(classifyContractorRecord(record)).toBe("ARCHIVED");
    expect(classifyContractorRecord(record)).toBe("ARCHIVED");
  });
});
