import { buildSemanticProfile, resolveSemanticValue } from "@/lib/empirePdf/semanticContext";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-semantic",
    companyName: "Empire Projects Pty Ltd",
    regNumber: "2020/123456/07",
    vatNumber: "4123456789",
    taxPin: "1234567890",
    cidb: "",
    csdNumber: "MAAA000001",
    bankingDetails: "",
    directors: "Jane Director",
    address: "1 Main Street, Johannesburg, South Africa",
    contactPerson: "Jane Director",
    email: "jane@example.com",
    phone: "0110000000",
    bbbeeLevel: "B-BBEE Level 1 Contributor",
    bbbeeStatus: "Level 1",
    signatoryRole: "Managing Director",
    missingFields: [],
    sourceAttribution: {},
    ...overrides,
  };
}

describe("semanticContext", () => {
  test("derives South African supplier and company type semantics", () => {
    const semantic = buildSemanticProfile(makeProfile());

    expect(semantic.companyType).toBe("PTY_LTD");
    expect(semantic.foreignSupplier).toBe(false);
    expect(resolveSemanticValue(semantic, "foreignSupplierNo")).toBe("true");
    expect(resolveSemanticValue(semantic, "foreignSupplierYes")).toBe("");
  });

  test("normalizes B-BBEE and signature semantics", () => {
    const semantic = buildSemanticProfile(makeProfile({ bbbeeLevel: "Level 2" }));

    expect(resolveSemanticValue(semantic, "bbbeeLevel")).toBe("Level 2");
    expect(resolveSemanticValue(semantic, "signatureName")).toBe("Jane Director");
    expect(resolveSemanticValue(semantic, "signatureRole")).toBe("Managing Director");
  });
});
