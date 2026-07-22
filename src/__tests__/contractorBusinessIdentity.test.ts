import {
  buildUnresolvedContractorIdentityFields,
  resolveContractorBusinessIdentity,
} from "@/lib/contractors/contractorBusinessIdentity";

describe("contractor business identity helper", () => {
  it("rejects placeholders, personal names, email values and technical identifiers", () => {
    for (const value of ["Unnamed Contractor", "Unknown", "Mr K", "contractor@example.com", "contractor-1"]) {
      const decision = resolveContractorBusinessIdentity({
        companyName: value,
        email: "contractor@example.com",
        contractorId: "contractor-1",
      });

      expect(decision.identityResolved).toBe(false);
    }
  });

  it("preserves verified legal name and trading name fallback", () => {
    expect(resolveContractorBusinessIdentity({ legalName: "Empire Civil Pty Ltd" })).toEqual(
      expect.objectContaining({ identityResolved: true, label: "Empire Civil Pty Ltd" }),
    );
    expect(resolveContractorBusinessIdentity({ tradingName: "Empire Civil" })).toEqual(
      expect.objectContaining({ identityResolved: true, label: "Empire Civil" }),
    );
  });

  it("fails closed on conflicting legal business evidence", () => {
    const decision = resolveContractorBusinessIdentity({
      legalName: "Empire Civil Pty Ltd",
      companyName: "Different Supplier Pty Ltd",
    });

    expect(decision.status).toBe("CONFLICT");
    expect(decision.identityResolved).toBe(false);
  });

  it("builds unresolved fields without positive business names or default workspace", () => {
    const fields = buildUnresolvedContractorIdentityFields({ source: "test" });

    expect(fields).toEqual(expect.objectContaining({
      identityResolved: false,
      identityStatus: "UNRESOLVED",
      businessIdentityEvidenceStatus: "MISSING",
      workspaceId: null,
      workspaceResolutionStatus: "UNRESOLVED",
    }));
    expect(fields).not.toHaveProperty("companyName");
    expect(fields).not.toHaveProperty("name");
  });
});
