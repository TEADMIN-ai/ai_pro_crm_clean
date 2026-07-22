import { buildContractorSelectorOption, buildContractorSelectorOptions } from "@/lib/contractors/contractorSelectorOptions";

const valid = {
  contractorId: "contractor-1",
  workspaceId: "workspace-1",
  status: "active",
  identityResolved: true,
  legalName: "Mackay and Daughters Enterprises (Pty) Ltd",
};

describe("canonical contractor selector options", () => {
  it("never uses the current authenticated user name as contractor fallback", () => {
    expect(buildContractorSelectorOption({ contractorId: "user-1", workspaceId: "workspace-1", status: "active", identityResolved: true, companyName: "Mr K", userId: "user-1" })).toBeNull();
  });

  it("excludes staff-only user records", () => {
    expect(buildContractorSelectorOption({ id: "staff-1", userId: "staff-1", role: "staff", name: "Mr K", workspaceId: "workspace-1", status: "active", identityResolved: true })).toBeNull();
  });

  it("excludes user records without contractor records", () => {
    expect(buildContractorSelectorOption({ id: "user-1", userId: "user-1", name: "Mr K", workspaceId: "workspace-1", status: "active", identityResolved: true })).toBeNull();
  });

  it("uses legalName as the display label", () => {
    expect(buildContractorSelectorOption(valid)).toMatchObject({ contractorId: "contractor-1", label: "Mackay and Daughters Enterprises (Pty) Ltd" });
  });

  it("uses tradingName when legalName is unavailable", () => {
    expect(buildContractorSelectorOption({ ...valid, legalName: undefined, tradingName: "F E Miller Pools" })).toMatchObject({ label: "F E Miller Pools" });
  });

  it("excludes unresolved contractors", () => {
    expect(buildContractorSelectorOption({ ...valid, identityResolved: false })).toBeNull();
  });

  it("excludes contractors missing workspaceId", () => {
    expect(buildContractorSelectorOption({ ...valid, workspaceId: undefined })).toBeNull();
  });

  it("excludes archived contractors", () => {
    expect(buildContractorSelectorOption({ ...valid, archived: true })).toBeNull();
  });

  it("excludes suspended contractors", () => {
    expect(buildContractorSelectorOption({ ...valid, status: "suspended" })).toBeNull();
  });

  it("uses canonical contractorId for assignment options", () => {
    expect(buildContractorSelectorOption({ ...valid, id: "doc-1", userId: "user-1" })?.contractorId).toBe("contractor-1");
  });

  it("does not substitute userId for contractorId", () => {
    expect(buildContractorSelectorOption({ ...valid, contractorId: undefined, userId: "user-1" })).toBeNull();
  });

  it("returns an empty list for empty contractor results", () => {
    expect(buildContractorSelectorOptions([])).toEqual([]);
  });

  it("removes the existing personal-name production path", () => {
    expect(buildContractorSelectorOptions([{ contractorId: "uid-1", userId: "uid-1", workspaceId: "workspace-1", status: "active", identityResolved: true, companyName: "Mr K" }])).toEqual([]);
  });
});
