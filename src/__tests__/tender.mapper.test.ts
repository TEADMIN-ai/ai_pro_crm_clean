import { mapLegacyTenderToTenderData } from "@/lib/tender/mappers/tender.mapper";

describe("mapLegacyTenderToTenderData", () => {
  test("maps legacy deal fields into canonical TenderData", () => {
    const tenderData = mapLegacyTenderToTenderData({
      id: "deal-123",
      title: "Road Upgrade Tender",
      companyId: "contractor-001",
      contractorId: "contractor-001",
      contractorName: "Torque Empire",
      status: "submitted",
      stage: "submitted",
      pricingStatus: "manager_approved",
      assignedTo: "user-1",
      value: 1250000,
      estimatedDealValue: 1300000,
      currency: "ZAR",
      readinessScore: 91,
      docsMissing: 1,
      tenderLockStatus: "RISK",
      readinessUpdatedAt: "2026-03-25T10:00:00.000Z",
      complianceMatch: true,
      missingRequirements: ["COIDA Letter"],
      riskLevel: "MEDIUM",
      tenderSubmittedAt: new Date("2026-03-25T09:00:00.000Z"),
      createdAt: new Date("2026-03-20T09:00:00.000Z"),
      updatedAt: new Date("2026-03-25T10:30:00.000Z"),
      pricingApprovedAt: new Date("2026-03-24T08:00:00.000Z"),
      tenderAnalysis: {
        issuingAuthority: "City of Johannesburg",
        tenderNumber: "COJ-2026-001",
        deadline: "2026-04-01",
        scope: "Upgrade roads",
        requiredCertificates: ["CSD", "Tax Clearance"],
        estimatedValue: 1300000,
        location: "Johannesburg",
        aiAnalyzedAt: "2026-03-21T12:00:00.000Z",
      },
      documents: [
        {
          id: "doc-1",
          name: "Tender Brief.pdf",
          uploadedAt: new Date("2026-03-22T08:30:00.000Z"),
          uploadedBy: "user-1",
          url: "https://example.com/doc-1.pdf",
        },
      ],
      auditTrail: [
        {
          id: "audit-1",
          type: "tender_submitted",
          timestamp: new Date("2026-03-25T09:00:00.000Z"),
          actor: {
            uid: "user-1",
            name: "Ops User",
            role: "manager",
            email: "ops@example.com",
          },
          meta: {
            source: "legacy-deal",
          },
        },
      ],
      metadata: {
        region: "Gauteng",
      },
      tags: ["roads", "municipal"],
    });

    expect(tenderData.tenderId).toBe("deal-123");
    expect(tenderData.legacyDealId).toBe("deal-123");
    expect(tenderData.title).toBe("Road Upgrade Tender");
    expect(tenderData.timeline.createdAt).toBe("2026-03-20T09:00:00.000Z");
    expect(tenderData.pricing).toMatchObject({
      status: "manager_approved",
      assignedTo: "user-1",
      value: { amount: 1250000, currency: "ZAR" },
    });
    expect(tenderData.compliance).toMatchObject({
      complianceMatch: true,
      tenderLockStatus: "RISK",
      readinessScore: 91,
    });
    expect(tenderData.metadata).toMatchObject({
      region: "Gauteng",
      legacyStatus: "submitted",
    });
    expect(tenderData.documents).toHaveLength(1);
    expect(tenderData.requirements.length).toBeGreaterThanOrEqual(3);
  });
});

