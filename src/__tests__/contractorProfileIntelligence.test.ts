import { buildContractorProfileIntelligence } from "@/lib/contractors/contractorProfileIntelligence";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import type { EngineDebugField } from "@/lib/empirePdf/templates";

function buildProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-123",
    companyName: "Empire Pty Ltd",
    regNumber: "",
    vatNumber: "",
    taxPin: "",
    cidb: "",
    csdNumber: "",
    bankingDetails: "",
    directors: "",
    address: "1 Empire Road",
    contactPerson: "Jane",
    email: "jane@example.com",
    phone: "",
    postalAddress: "1 Empire Road",
    streetAddress: "1 Empire Road",
    directorName: "",
    signatoryRole: "",
    businessType: "",
    country: "",
    missingFields: [],
    sourceAttribution: {
      companyName: "contractor",
      address: "contractor",
      contactPerson: "contractor",
      email: "contractor",
      postalAddress: "default",
      streetAddress: "default",
    },
    ...overrides,
  };
}

function buildRendererField(overrides: Partial<EngineDebugField> = {}): EngineDebugField {
  return {
    fieldId: "postal_address",
    pageIndex: 0,
    fieldKey: "SBD1.postal_address",
    value: "1 Empire Road",
    rendered: true,
    renderSuccess: true,
    usedFallback: true,
    fallbackUsed: true,
    anchorFound: false,
    matchedAnchor: null,
    anchorUsed: false,
    anchorText: "POSTAL ADDRESS",
    aliasMatched: "POSTAL ADDRESS",
    semanticAliasUsed: "POSTAL ADDRESS",
    source: "contractor.address",
    sourceField: "contractor.address",
    confidence: 0.58,
    resolutionStrategy: "placement_fallback",
    criticality: "important",
    missingDependencies: ["postalAddress"],
    overflowDetected: true,
    clippingRisk: false,
    multilineOverflowDetected: true,
    renderDurationMs: 8,
    x: 10,
    y: 10,
    fontSize: 8,
    ...overrides,
  };
}

describe("contractorProfileIntelligence", () => {
  it("classifies critical and recommended correction priorities deterministically", () => {
    const result = buildContractorProfileIntelligence({
      contractorId: "contractor-123",
      profile: buildProfile(),
    });

    expect(result.missingCriticalFields).toContain("regNumber");
    expect(result.recommendedCorrections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "regNumber",
          priority: "critical",
        }),
        expect.objectContaining({
          field: "signatoryRole",
          priority: "recommended",
        }),
      ])
    );
    expect(result.categories.identity.criticalMissingFields).toContain("regNumber");
    expect(result.readinessImpact).toBe("blocking");
  });

  it("becomes renderer-aware for low confidence, overflow, and fallback dependence", () => {
    const rendererFields: EngineDebugField[] = [
      buildRendererField(),
      buildRendererField({
        fieldId: "signature_role",
        fieldKey: "SBD4.signature_role",
        anchorText: "CAPACITY",
        source: "semantic.signatureRole",
        sourceField: "semantic.signatureRole",
        confidence: 0.62,
        fallbackUsed: false,
        usedFallback: false,
        overflowDetected: false,
        multilineOverflowDetected: false,
        clippingRisk: false,
        missingDependencies: ["signatoryRole"],
      }),
    ];

    const result = buildContractorProfileIntelligence({
      contractorId: "contractor-123",
      profile: buildProfile(),
      rendererFields,
    });

    expect(result.rendererHealth).toBe("fallback_dependent");
    expect(result.lowConfidenceFields).toEqual(
      expect.arrayContaining(["SBD1.postal_address", "SBD4.signature_role"])
    );
    expect(result.overflowRiskFields).toContain("SBD1.postal_address");
    expect(result.categories.address.rendererImpact).toBe("high");
    expect(result.categories.signatory.missingFields).toContain("signatoryRole");
    expect(result.telemetry.lowConfidenceFieldCount).toBe(2);
  });
});
