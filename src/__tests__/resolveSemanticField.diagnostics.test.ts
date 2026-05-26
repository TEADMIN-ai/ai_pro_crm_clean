import { buildSemanticProfile } from "@/lib/empirePdf/semanticContext";
import { resolveSemanticField } from "@/lib/empirePdf/semanticRegistry";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";

function buildCompanyProfileFixture(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-1",
    companyName: "Empire Pty Ltd",
    regNumber: "2019/123456/07",
    vatNumber: "",
    taxPin: "",
    cidb: "",
    csdNumber: "",
    bankingDetails: "",
    directors: "",
    address: "1 Empire Road, Johannesburg",
    contactPerson: "Jane Contact",
    email: "",
    phone: "",
    bbbeeLevel: "",
    bbbeeStatus: "",
    country: "",
    postalAddress: "",
    streetAddress: "",
    directorName: "",
    signatoryRole: "",
    businessType: "",
    missingFields: [],
    sourceAttribution: {
      companyName: "contractor",
      regNumber: "contractor",
      address: "contractor",
      contactPerson: "contractor",
    },
    ...overrides,
  };
}

describe("resolveSemanticField diagnostics", () => {
  it("surfaces address fallback dependencies for postal address fields", () => {
    const profile = buildSemanticProfile(buildCompanyProfileFixture());

    const result = resolveSemanticField({
      formId: "SBD1",
      fieldId: "postal_address",
      anchorText: "POSTAL ADDRESS",
      profile,
    });

    expect(result.value).toBe("1 Empire Road, Johannesburg");
    expect(result.sourceField).toBe("contractor.address");
    expect(result.missingDependencies).toEqual(["postalAddress"]);
    expect(result.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "missing dependency 'postalAddress' for postal_address",
        }),
      ])
    );
  });

  it("surfaces missing signatory role when semantic defaults are used", () => {
    const profile = buildSemanticProfile(buildCompanyProfileFixture());

    const result = resolveSemanticField({
      formId: "SBD4",
      fieldId: "signature_role",
      anchorText: "CAPACITY",
      profile,
    });

    expect(result.value).toBe("Authorized Signatory");
    expect(result.sourceField).toBe("semantic.signatureRole");
    expect(result.missingDependencies).toEqual(["signatoryRole"]);
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "missing dependency 'signatoryRole' for signature_role",
        }),
      ])
    );
  });
});
