import {
  getDealContractorDisplayName,
  isDealContractorResolved,
} from "@/lib/deals/contractorReferenceDisplay";

describe("contractor reference display", () => {
  it("displays the contractor business name instead of the raw ID", () => {
    expect(
      getDealContractorDisplayName({
        contractorId: "contractor-doc",
        contractorName: "F.E. Miller Pools",
        contractorReferenceResolution: { status: "resolved" },
      }),
    ).toBe("F.E. Miller Pools");
  });

  it("marks canonical resolved contractor links as openable", () => {
    expect(
      isDealContractorResolved({
        contractorId: "contractor-doc",
        contractorReferenceResolution: { status: "resolved" },
      }),
    ).toBe(true);
  });

  it("shows a proper orphaned-link state", () => {
    const deal = {
      contractorId: "legacy-orphan",
      contractorReferenceResolution: {
        status: "unresolved" as const,
        failureReason: "not_found",
      },
    };

    expect(getDealContractorDisplayName(deal)).toBe("Linked contractor record could not be resolved.");
    expect(isDealContractorResolved(deal)).toBe(false);
  });
});
