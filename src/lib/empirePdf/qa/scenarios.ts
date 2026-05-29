import type { CompanyProfile, CompanyProfileFieldKey } from "@/lib/autofill/buildCompanyProfile";

export type EmpirePdfQaScenario = {
  id: string;
  label: string;
  purpose: string;
  profile: CompanyProfile;
};

function buildSourceAttribution(profile: CompanyProfile): CompanyProfile["sourceAttribution"] {
  const sourceAttribution: CompanyProfile["sourceAttribution"] = {};
  const keys: CompanyProfileFieldKey[] = [
    "companyName",
    "regNumber",
    "vatNumber",
    "taxPin",
    "cidb",
    "csdNumber",
    "bankingDetails",
    "directors",
    "address",
    "contactPerson",
    "email",
    "phone",
    "bbbeeLevel",
    "bbbeeIssueDate",
    "bbbeeStatus",
    "country",
    "postalAddress",
    "streetAddress",
    "directorName",
    "signatoryRole",
    "businessType",
  ];

  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) {
      sourceAttribution[key] = "contractor";
    }
  }

  return sourceAttribution;
}

function createProfile(
  contractorId: string,
  overrides: Partial<Omit<CompanyProfile, "contractorId" | "missingFields" | "sourceAttribution">>
): CompanyProfile {
  const profile: CompanyProfile = {
    contractorId,
    companyName: "Empire Civil Projects (Pty) Ltd",
    regNumber: "2019/123456/07",
    vatNumber: "4123456789",
    taxPin: "A1B2C3D4E5",
    cidb: "7CE PE",
    csdNumber: "MAAA0123456",
    bankingDetails: "Standard Bank 051001 2200112233",
    directors: "Nomsa Dlamini",
    address: "12 Empire Boulevard, Midrand, Gauteng, South Africa",
    contactPerson: "Nomsa Dlamini",
    email: "tenders@empirecivil.co.za",
    phone: "011 555 0199",
    bbbeeLevel: "Level 1",
    bbbeeIssueDate: "01/04/2026",
    bbbeeStatus: "Level 1",
    country: "South Africa",
    postalAddress: "PO Box 901, Midrand, 1685, South Africa",
    streetAddress: "12 Empire Boulevard, Midrand, Gauteng, South Africa",
    directorName: "Nomsa Dlamini",
    signatoryRole: "Managing Director",
    businessType: "(Pty) Ltd",
    missingFields: [],
    sourceAttribution: {},
    ...overrides,
  };

  profile.sourceAttribution = buildSourceAttribution(profile);
  return profile;
}

export const EMPIRE_PDF_QA_SCENARIOS: EmpirePdfQaScenario[] = [
  {
    id: "baseline_local_pty",
    label: "Baseline Local PTY",
    purpose: "Reference calibration for standard South African PTY supplier values.",
    profile: createProfile("qa-baseline-local-pty", {}),
  },
  {
    id: "short_name_micro_supplier",
    label: "Short Name Micro Supplier",
    purpose: "Verifies short-value alignment and no over-centering for compact company names.",
    profile: createProfile("qa-short-name-micro-supplier", {
      companyName: "KJ Works",
      regNumber: "2024/998877/07",
      postalAddress: "PO Box 7, Edenvale, 1610, South Africa",
      streetAddress: "7 4th Avenue, Edenvale, Gauteng, South Africa",
      directorName: "Kabelo Jansen",
      contactPerson: "Kabelo Jansen",
      signatoryRole: "Owner",
      businessType: "Sole Proprietor",
      bbbeeLevel: "Level 4",
      bbbeeStatus: "Level 4",
    }),
  },
  {
    id: "long_legal_name_enterprise",
    label: "Long Legal Name Enterprise",
    purpose: "Exercises adaptive scaling for long legal names and long-but-local procurement identities.",
    profile: createProfile("qa-long-legal-name-enterprise", {
      companyName:
        "Empire Infrastructure Procurement and Strategic Delivery Holdings Proprietary Limited",
      postalAddress:
        "PO Box 48192, Vorna Valley, Midrand, 1686, Gauteng, South Africa, National Tender Operations Centre",
      streetAddress:
        "Block B, Empire Commercial Campus, 1285 Lever Road, Vorna Valley, Midrand, Gauteng, South Africa",
      directorName: "Thandeka Mthembu-Stein",
      signatoryRole: "Group Executive Director",
    }),
  },
  {
    id: "foreign_supplier_edge_case",
    label: "Foreign Supplier Edge Case",
    purpose: "Validates foreign-supplier checkbox polarity and non-PTY company-type behavior.",
    profile: createProfile("qa-foreign-supplier-edge-case", {
      companyName: "Kalahari Pipeline Consortium",
      country: "Namibia",
      address: "44 Independence Avenue, Windhoek, Namibia",
      postalAddress: "PO Box 1456, Windhoek, Namibia",
      streetAddress: "44 Independence Avenue, Windhoek, Namibia",
      businessType: "Consortium",
      bbbeeLevel: "",
      bbbeeStatus: "",
      directorName: "Kabelo van Wyk",
      signatoryRole: "Lead Consortium Representative",
    }),
  },
  {
    id: "signature_overflow_stress",
    label: "Signature Overflow Stress",
    purpose: "Pushes signature name and role lengths to test deterministic scaling in SBD1 and SBD4 signature zones.",
    profile: createProfile("qa-signature-overflow-stress", {
      directorName:
        "Dr Thandolwethu Bhekizizwe Maseko-Ndlovu",
      contactPerson:
        "Dr Thandolwethu Bhekizizwe Maseko-Ndlovu",
      signatoryRole:
        "Executive Head of Infrastructure Procurement, Governance and Commercial Risk",
    }),
  },
  {
    id: "address_overflow_stress",
    label: "Address Overflow Stress",
    purpose: "Stresses multiline wrapping, line-height discipline, and max-line handling for postal and street addresses.",
    profile: createProfile("qa-address-overflow-stress", {
      postalAddress:
        "Tender Administration Unit, Private Bag X128, Procurement House, 39 Rivonia Road Extension, Sandton, Johannesburg, 2146, South Africa",
      streetAddress:
        "Warehouse 17, Empire Logistics and Response Campus, 221 Old Pretoria Main Road, Halfway House, Midrand, Gauteng, South Africa",
      companyName: "Empire Response Systems (Pty) Ltd",
      directorName: "Lerato Khumalo",
      signatoryRole: "Authorized Signatory",
    }),
  },
];
