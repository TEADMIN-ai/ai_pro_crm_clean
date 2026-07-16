import {
  formatContractorDate,
  getContractorBusinessName,
  getContractorCanonicalId,
  getContractorWorkspaceLabel,
  summarizeContractorList,
  type ContractorListItem,
} from "@/lib/contractors/contractorListModel";

describe("contractorListModel", () => {
  it("displays business names instead of raw IDs when a name is present", () => {
    expect(
      getContractorBusinessName({
        id: "contractor-doc",
        contractorId: "auth-uid",
        companyName: "Mackay and Daughters",
      }),
    ).toBe("Mackay and Daughters");
  });

  it("falls back through supported contractor name fields", () => {
    expect(getContractorBusinessName({ id: "c1", businessName: "F.E. Miller Pools" })).toBe("F.E. Miller Pools");
    expect(getContractorBusinessName({ id: "c2", legalName: "Legal Contractor Pty Ltd" })).toBe(
      "Legal Contractor Pty Ltd",
    );
    expect(getContractorBusinessName({ id: "c3", tradingName: "Trading Contractor" })).toBe("Trading Contractor");
    expect(getContractorBusinessName({ id: "c4", name: "Named Contractor" })).toBe("Named Contractor");
  });

  it("uses the canonical contractor document ID when contractorId is absent", () => {
    expect(getContractorCanonicalId({ id: "contractor-doc" })).toBe("contractor-doc");
  });

  it("uses an explicit contractorId when the record provides one", () => {
    expect(getContractorCanonicalId({ id: "contractor-doc", contractorId: "canonical-id" })).toBe("canonical-id");
  });

  it("reports current workspace labels", () => {
    expect(getContractorWorkspaceLabel({ id: "contractor-doc", workspaceId: "torque-empire" })).toBe(
      "torque-empire",
    );
  });

  it("reports valid legacy records without workspace IDs", () => {
    expect(getContractorWorkspaceLabel({ id: "legacy-contractor" })).toBe("Legacy / unassigned");
    expect(summarizeContractorList([{ id: "legacy-contractor", companyName: "Legacy Contractor" }])).toMatchObject({
      legacyWithoutWorkspace: 1,
    });
  });

  it("does not report repository failure as a zero-record summary", () => {
    expect(summarizeContractorList([])).toEqual({
      total: 0,
      approved: 0,
      pendingReview: 0,
      onboarding: 0,
      legacyWithoutWorkspace: 0,
      duplicateBusinessNames: [],
    });
  });

  it("counts approved and pending contractor states", () => {
    const contractors: ContractorListItem[] = [
      { id: "approved", companyName: "Approved Contractor", complianceApproved: true, workspaceId: "w1" },
      { id: "review", companyName: "Review Contractor", overallStatus: "Pending Review", workspaceId: "w1" },
      { id: "onboarding", companyName: "Onboarding Contractor", docsMissing: 2, workspaceId: "w1" },
    ];

    expect(summarizeContractorList(contractors)).toMatchObject({
      total: 3,
      approved: 1,
      pendingReview: 1,
      onboarding: 1,
    });
  });

  it("flags duplicate business names without merging records", () => {
    const summary = summarizeContractorList([
      { id: "c1", companyName: "Mackay and Daughters", workspaceId: "w1" },
      { id: "c2", companyName: "mackay  and daughters", workspaceId: "w1" },
      { id: "c3", companyName: "F.E. Miller Pools", workspaceId: "w1" },
    ]);

    expect(summary.duplicateBusinessNames).toEqual([{ name: "Mackay and Daughters", ids: ["c1", "c2"] }]);
  });

  it("formats contractor update dates for the operational table", () => {
    expect(formatContractorDate("2026-06-05T00:00:00.000Z")).toContain("2026");
    expect(formatContractorDate(null)).toBe("Not recorded");
    expect(formatContractorDate("not-a-date")).toBe("Not recorded");
  });
});

