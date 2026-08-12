import { resolveContractorBusinessIdentity } from "@/lib/contractors/contractorBusinessIdentity";

describe("staging assignment recovery", () => {
  test("explicit business identity is not invalidated when legacy name mirrors companyName", () => {
    const decision = resolveContractorBusinessIdentity({
      id: "contractor-1",
      contractorId: "contractor-1",
      email: "test+contractor@example.com",
      name: "Torque Empire STAGING TEST Contractor",
      companyName: "Torque Empire STAGING TEST Contractor",
      company: "Torque Empire STAGING TEST Contractor",
      identityResolved: true,
    });

    expect(decision.status).toBe("VERIFIED");
    expect(decision.identityResolved).toBe(true);
    expect(decision.label).toBe("Torque Empire STAGING TEST Contractor");
    expect(decision.warnings).not.toContain("Business identity is derived from personal profile evidence");
  });
});
