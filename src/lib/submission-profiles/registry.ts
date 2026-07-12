import type {
  SubmissionAnnexure,
  SubmissionDocumentRequirement,
  SubmissionFormRequirement,
  SubmissionProfileDefinition,
  SubmissionSignatureRequirement,
  SubmissionValidationRule,
} from "./types";

function defineDocuments(items: SubmissionDocumentRequirement[]): SubmissionDocumentRequirement[] {
  return items;
}

function defineForms(items: SubmissionFormRequirement[]): SubmissionFormRequirement[] {
  return items;
}

function defineAnnexures(items: SubmissionAnnexure[]): SubmissionAnnexure[] {
  return items;
}

function defineSignatures(items: SubmissionSignatureRequirement[]): SubmissionSignatureRequirement[] {
  return items;
}

function defineRules(items: SubmissionValidationRule[]): SubmissionValidationRule[] {
  return items;
}

export const submissionProfiles: SubmissionProfileDefinition[] = [
  {
    key: "government",
    label: "Government",
    audience: "National and provincial procurement submissions",
    summary: "Strict public-sector submission profile with formal forms, signed declarations and audit-grade naming.",
    readinessClassification: "Release-gated",
    requiredDocuments: defineDocuments([
      { key: "tax-clearance", label: "Tax Clearance Certificate", mandatory: true },
      { key: "cipc", label: "CIPC Registration", mandatory: true },
      { key: "csd", label: "Central Supplier Database Registration", mandatory: true },
      { key: "bank-confirmation", label: "Bank Confirmation Letter", mandatory: true },
      { key: "identity", label: "Authorized Signatory Identity", mandatory: true },
    ]),
    requiredForms: defineForms([
      { key: "sbd1", label: "SBD1 Invitation to Bid", mandatory: true },
      { key: "sbd4", label: "SBD4 Declaration of Interest", mandatory: true },
      { key: "sbd6-1", label: "SBD6.1 Preference Claim", mandatory: true },
    ]),
    annexures: defineAnnexures([
      { key: "company-profile", label: "Company Profile" },
      { key: "pricing", label: "Pricing Schedule" },
      { key: "authority-letter", label: "Authority to Sign" },
      { key: "supporting-evidence", label: "Supporting Evidence Bundle" },
    ]),
    namingConvention: "GOV-<entity>-<reference>-<yyyymmdd>",
    pageOrder: ["cover", "profile-summary", "required-documents", "required-forms", "annexures", "signatures"],
    validationRules: defineRules([
      { key: "no-branding", label: "No TEOS branding", detail: "Government submissions must exclude TEOS branding pages and internal stamps." },
      { key: "forms-signed", label: "Forms signed", detail: "Required forms must carry an authorized signature before release." },
      { key: "latest-documents", label: "Latest documents only", detail: "Use current certificates and confirmations where expiry dates apply." },
    ]),
    signatureRequirements: defineSignatures([
      { role: "Authorized Signatory", count: 1, note: "Wet-ink or verified digital signature accepted." },
      { role: "Witness", count: 1, note: "Required where the procurement form calls for a witness." },
    ]),
  },
  {
    key: "municipal",
    label: "Municipal",
    audience: "Local authority and municipal procurement submissions",
    summary: "Municipal submission profile with localized declarations, formal pack order and compliance gates.",
    readinessClassification: "Compliance-gated",
    requiredDocuments: defineDocuments([
      { key: "tax-clearance", label: "Tax Clearance Certificate", mandatory: true },
      { key: "cidb", label: "CIDB Registration", mandatory: true },
      { key: "sars", label: "SARS Good Standing", mandatory: true },
      { key: "bank-confirmation", label: "Bank Confirmation Letter", mandatory: true },
      { key: "municipal-account", label: "Municipal Account Clearance", mandatory: false },
    ]),
    requiredForms: defineForms([
      { key: "sbd1", label: "SBD1 Invitation to Bid", mandatory: true },
      { key: "sbd4", label: "SBD4 Declaration of Interest", mandatory: true },
      { key: "pricing-schedule", label: "Pricing Schedule", mandatory: true },
    ]),
    annexures: defineAnnexures([
      { key: "company-profile", label: "Company Profile" },
      { key: "locality-proof", label: "Proof of Local Presence" },
      { key: "references", label: "Recent References" },
    ]),
    namingConvention: "MUN-<municipality>-<reference>-<yyyymmdd>",
    pageOrder: ["cover", "compliance-summary", "required-documents", "pricing", "signatures", "annexures"],
    validationRules: defineRules([
      { key: "locality", label: "Locality evidence", detail: "Where required, include the locality or trading address evidence." },
      { key: "signature-order", label: "Signature order", detail: "Authorizing signature must follow the stated municipal pack sequence." },
      { key: "clean-pack", label: "Clean submission pack", detail: "Exclude internal working notes from the release pack." },
    ]),
    signatureRequirements: defineSignatures([
      { role: "Authorized Signatory", count: 1 },
      { role: "Witness", count: 1, note: "Only where prescribed by the municipality." },
    ]),
  },
  {
    key: "private",
    label: "Private",
    audience: "Private-sector bids and vendor onboarding submissions",
    summary: "Flexible submission profile for private buyers with lighter declarations and faster review cycles.",
    readinessClassification: "Fast-track",
    requiredDocuments: defineDocuments([
      { key: "company-registration", label: "Company Registration", mandatory: true },
      { key: "bank-confirmation", label: "Bank Confirmation Letter", mandatory: true },
      { key: "tax", label: "Tax Registration", mandatory: true },
      { key: "references", label: "Trade References", mandatory: false },
    ]),
    requiredForms: defineForms([
      { key: "vendor-form", label: "Vendor Onboarding Form", mandatory: true },
      { key: "pricing-summary", label: "Pricing Summary", mandatory: true },
    ]),
    annexures: defineAnnexures([
      { key: "company-overview", label: "Company Overview" },
      { key: "insurance", label: "Insurance Schedule" },
    ]),
    namingConvention: "PRV-<client>-<reference>-<yyyymmdd>",
    pageOrder: ["cover", "summary", "documents", "forms", "annexures"],
    validationRules: defineRules([
      { key: "buyer-brand", label: "Buyer brand only", detail: "Use client-facing labels, not TEOS workspace labels." },
      { key: "concise-pack", label: "Concise pack", detail: "Keep the pack short and focused on buyer review." },
    ]),
    signatureRequirements: defineSignatures([
      { role: "Authorized Signatory", count: 1 },
    ]),
  },
  {
    key: "corporate",
    label: "Corporate",
    audience: "Enterprise vendor panel and corporate RFQ submissions",
    summary: "Corporate submission profile with controlled declarations, branded annexures and executive sign-off.",
    readinessClassification: "Executive-gated",
    requiredDocuments: defineDocuments([
      { key: "company-registration", label: "Company Registration", mandatory: true },
      { key: "tax", label: "Tax Registration", mandatory: true },
      { key: "bank-confirmation", label: "Bank Confirmation Letter", mandatory: true },
      { key: "references", label: "Executive References", mandatory: true },
    ]),
    requiredForms: defineForms([
      { key: "vendor-profile", label: "Vendor Profile Form", mandatory: true },
      { key: "declarations", label: "Declarations Sheet", mandatory: true },
    ]),
    annexures: defineAnnexures([
      { key: "company-profile", label: "Company Profile" },
      { key: "service-catalogue", label: "Service Catalogue" },
      { key: "esg", label: "ESG Summary" },
    ]),
    namingConvention: "COR-<client>-<reference>-<yyyymmdd>",
    pageOrder: ["cover", "executive-summary", "documents", "forms", "annexures", "signatures"],
    validationRules: defineRules([
      { key: "executive-signoff", label: "Executive sign-off", detail: "Corporate packs require an executive approver before release." },
      { key: "no-internal-notes", label: "No internal notes", detail: "Remove internal commentary from the external package." },
      { key: "controlled-annexures", label: "Controlled annexures", detail: "Annexures must be versioned and traceable." },
    ]),
    signatureRequirements: defineSignatures([
      { role: "Executive Approver", count: 1 },
      { role: "Authorized Signatory", count: 1 },
    ]),
  },
  {
    key: "construction",
    label: "Construction",
    audience: "Construction, infrastructure and site delivery submissions",
    summary: "Construction submission profile with delivery assurance, site controls and trade-specific forms.",
    readinessClassification: "Delivery-gated",
    requiredDocuments: defineDocuments([
      { key: "cidb", label: "CIDB Registration", mandatory: true },
      { key: "o-h-s", label: "Occupational Health and Safety Plan", mandatory: true },
      { key: "insurance", label: "Insurance Certificate", mandatory: true },
      { key: "bank-confirmation", label: "Bank Confirmation Letter", mandatory: true },
    ]),
    requiredForms: defineForms([
      { key: "construction-sbd1", label: "SBD1 Invitation to Bid", mandatory: true },
      { key: "construction-pricing", label: "Construction Pricing Schedule", mandatory: true },
    ]),
    annexures: defineAnnexures([
      { key: "programme", label: "Work Programme" },
      { key: "equipment", label: "Plant and Equipment Schedule" },
      { key: "subcontractors", label: "Subcontractor List" },
    ]),
    namingConvention: "CON-<project>-<reference>-<yyyymmdd>",
    pageOrder: ["cover", "site-readiness", "documents", "forms", "annexures", "signatures"],
    validationRules: defineRules([
      { key: "site-controls", label: "Site control evidence", detail: "Include safety and site-readiness documents before release." },
      { key: "programme-order", label: "Programme order", detail: "Construction packs should list schedule and trade dependencies early." },
    ]),
    signatureRequirements: defineSignatures([
      { role: "Project Director", count: 1 },
      { role: "Safety Representative", count: 1, note: "Required for site-sensitive submissions." },
    ]),
  },
];










