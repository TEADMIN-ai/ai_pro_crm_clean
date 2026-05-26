import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { buildSemanticProfile } from "@/lib/empirePdf/semanticContext";
import { resolveSemanticField } from "@/lib/empirePdf/semanticRegistry";

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-semantic-registry",
    companyName: "Torque Empire PTY Ltd",
    regNumber: "2019/123456/07",
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
    bbbeeLevel: "Level 1",
    bbbeeStatus: "Level 1",
    country: "South Africa",
    postalAddress: "PO Box 1, Johannesburg, 2000",
    streetAddress: "1 Main Street, Johannesburg",
    directorName: "Jane Director",
    signatoryRole: "Managing Director",
    businessType: "(Pty) Ltd",
    missingFields: [],
    sourceAttribution: {
      companyName: "contractor",
      regNumber: "contractor",
      taxPin: "contractor",
    },
    ...overrides,
  };
}

describe("semanticRegistry", () => {
  test("resolves procurement aliases to the same contractor source", () => {
    const profile = buildSemanticProfile(makeProfile());
    const bidderName = resolveSemanticField({
      formId: "SBD1",
      fieldId: "company_name",
      anchorText: "BIDDER NAME",
      profile,
    });
    const legalEntity = resolveSemanticField({
      formId: "SBD1",
      fieldId: "company_name",
      anchorText: "LEGAL ENTITY NAME",
      profile,
    });
    const ckNumber = resolveSemanticField({
      formId: "SBD6.1",
      fieldId: "registration_number",
      anchorText: "CK NUMBER",
      profile,
    });

    expect(bidderName.value).toBe("Torque Empire PTY Ltd");
    expect(legalEntity.value).toBe("Torque Empire PTY Ltd");
    expect(bidderName.source).toBe("contractor.companyName");
    expect(legalEntity.source).toBe("contractor.companyName");
    expect(ckNumber.value).toBe("2019/123456/07");
    expect(ckNumber.source).toBe("contractor.regNumber");
    expect(bidderName.confidence).toBeGreaterThanOrEqual(0.95);
    expect(ckNumber.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test("applies checkbox semantics for South African suppliers and PTY LTD entities", () => {
    const profile = buildSemanticProfile(makeProfile());
    const foreignYes = resolveSemanticField({
      formId: "SBD1",
      fieldId: "foreign_supplier_yes",
      anchorText: "FOREIGN SUPPLIER",
      profile,
    });
    const foreignNo = resolveSemanticField({
      formId: "SBD1",
      fieldId: "foreign_supplier_no",
      anchorText: "ARE YOU A FOREIGN BASED SUPPLIER",
      profile,
    });
    const supplierType = resolveSemanticField({
      formId: "SBD1",
      fieldId: "supplier_type_pty_ltd",
      anchorText: "PTY LTD",
      profile,
    });

    expect(foreignYes.value).toBe("");
    expect(foreignNo.value).toBe("true");
    expect(supplierType.value).toBe("true");
    expect(foreignNo.confidence).toBeGreaterThanOrEqual(0.95);
    expect(supplierType.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test("raises review flags for low-confidence or missing contractor data", () => {
    const profile = buildSemanticProfile(
      makeProfile({
        taxPin: "",
        sourceAttribution: {
          companyName: "contractor",
          taxPin: "default",
        },
      })
    );

    const resolved = resolveSemanticField({
      formId: "SBD1",
      fieldId: "tax_pin",
      anchorText: "ENTITY TAX PIN",
      profile,
    });

    expect(resolved.value).toBe("");
    expect(resolved.confidence).toBeLessThan(0.7);
    expect(resolved.reviewFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "tax_pin",
        }),
      ])
    );
  });
});
