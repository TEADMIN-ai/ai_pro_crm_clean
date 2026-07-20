import {
  buildAssignContractorRequest,
  canManageDealContractorLink,
  getContractorLinkActionLabel,
} from "@/lib/deals/dealsHubContractorAssignment";

describe("Deals Hub contractor assignment helpers", () => {
  it("allows only admin, manager, and staff roles to manage deal contractor links", () => {
    expect(canManageDealContractorLink("admin")).toBe(true);
    expect(canManageDealContractorLink("manager")).toBe(true);
    expect(canManageDealContractorLink("staff")).toBe(true);

    expect(canManageDealContractorLink("contractor")).toBe(false);
    expect(canManageDealContractorLink("driver")).toBe(false);
    expect(canManageDealContractorLink("auditor")).toBe(false);
    expect(canManageDealContractorLink("viewer")).toBe(false);
    expect(canManageDealContractorLink("guest")).toBe(false);
  });

  it("builds the canonical opportunity execution assign_contractor request", () => {
    expect(buildAssignContractorRequest(" contractor-c ")).toEqual({
      action: "assign_contractor",
      contractorId: "contractor-c",
    });
  });

  it("labels link and change actions from the current contractor state", () => {
    expect(getContractorLinkActionLabel(null)).toBe("Link Contractor");
    expect(getContractorLinkActionLabel("")).toBe("Link Contractor");
    expect(getContractorLinkActionLabel("contractor-c")).toBe("Change Contractor");
  });
});
