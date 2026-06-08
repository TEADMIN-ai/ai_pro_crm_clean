import { normalizeDeal } from "@/lib/deals/normalizeDeal";

describe("contractor tender summary", () => {
  test("preserves additive contractor-facing RFQ summary fields on deals", () => {
    const deal = normalizeDeal("deal-1", {
      title: "RFQ 1",
      companyId: "contractor-1",
      contractorId: "contractor-1",
      contractorTenderSummary: {
        scopeOfWork: "Supply hygiene consumables",
        closingDate: "2026-06-10 11:00",
        briefingSessionRequired: "yes",
        briefingDateTime: "2026-06-03 10:00",
        briefingType: "MS Teams",
        briefingLocationOrPlatform: "Microsoft Teams",
        requiredDocuments: ["Tax Clearance", "B-BBEE"],
        eligibilityRequirements: ["CSD registration"],
        mainRiskNotes: ["Short turnaround"],
        contractorActionChecklist: ["Upload current tax document"],
        aiAnalyzedAt: "2026-06-01T10:00:00.000Z",
      },
    });

    expect(deal.contractorTenderSummary).toMatchObject({
      scopeOfWork: "Supply hygiene consumables",
      briefingSessionRequired: "yes",
      briefingType: "MS Teams",
      requiredDocuments: ["Tax Clearance", "B-BBEE"],
      contractorActionChecklist: ["Upload current tax document"],
    });
  });
});
