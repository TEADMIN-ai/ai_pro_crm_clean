import { auditContractorIdentityRecords } from "@/lib/contractors/contractorIdentityAudit";

describe("contractor identity audit", () => {
  it("classifies suspect contractor identity records with evidence and links", () => {
    const report = auditContractorIdentityRecords({
      generatedAt: "2026-07-22T00:00:00.000Z",
      allowlist: ["contractor-allowed"],
      contractors: [
        {
          id: "contractor-1",
          contractorId: "contractor-1",
          companyName: "Mr K",
          authUid: "user-1",
          workspaceId: "workspace-a",
          identityResolved: true,
        },
        {
          id: "contractor-allowed",
          contractorId: "contractor-allowed",
          companyName: "contractor-allowed",
          email: "contractor-allowed@example.com",
        },
        {
          id: "contractor-ok",
          contractorId: "contractor-ok",
          legalName: "Empire Civil Pty Ltd",
          workspaceId: "workspace-a",
          identityResolved: true,
        },
      ],
      users: [{ id: "user-1", contractorId: "contractor-1" }],
      recommendations: [{ id: "rec-1", contractorId: "contractor-1" }],
      assignments: [{ id: "deal-1", contractorId: "contractor-1" }],
    });

    expect(report.mode).toBe("dry-run");
    expect(report.summary.contractorsReviewed).toBe(3);
    expect(report.summary.suspectRecords).toBe(2);
    expect(report.records[0]).toEqual(expect.objectContaining({
      contractorId: "contractor-1",
      risk: "CRITICAL",
      linkedUsers: ["user-1"],
      recommendations: ["rec-1"],
      assignments: ["deal-1"],
    }));
    expect(report.records[0].reasons).toEqual(expect.arrayContaining([
      "personal-name-only business identity",
      "identityResolved true without verified business evidence",
    ]));
    expect(report.records.find((record) => record.contractorId === "contractor-allowed")?.allowedByAllowlist).toBe(true);
    expect(report.humanReadable).toContain("Contractor Identity Audit");
  });
});
