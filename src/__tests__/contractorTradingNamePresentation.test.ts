import { getContractorTradingName } from "@/lib/contractors/contractorListModel";

describe("contractor trading name presentation", () => {
  it("keeps missing trading name explicit instead of substituting the business name", () => {
    expect(getContractorTradingName({ id: "contractor-doc", businessName: "Mackay Civil" })).toBe("Not recorded");
  });

  it("displays a recorded trading name", () => {
    expect(getContractorTradingName({ id: "contractor-doc", tradingName: "Mackay Civil Trading" })).toBe(
      "Mackay Civil Trading",
    );
  });
});

