
export const STAGING_FIREBASE_PROJECT_ID = "torque-empire-ai-pro-crm-staging";
export const STAGING_ENVIRONMENT = "staging";
export const STAGING_SEED_VERSION = "staging-uat-v1";
export const STAGING_SEED_CREATED_BY = "staging-seed";
export const STAGING_WORKSPACE_ID = "teos-staging-uat";

export const STAGING_ADMIN_EMAIL = "teos.staging.admin@invalid.example";
export const STAGING_STAFF_EMAIL = "teos.staging.staff@invalid.example";
export const STAGING_CANONICAL_CONTRACTOR_ID = "staging-uat-canonical-contractor";
export const STAGING_UNRESOLVED_CONTRACTOR_ID = "staging-uat-unresolved-contractor";
export const STAGING_SYNTHETIC_DEAL_ID = "staging-uat-rfq-opportunity";

export type StagingUserRole = "admin" | "staff";

export type StagingUserSpec = {
  key: StagingUserRole;
  email: string;
  displayName: string;
  passwordEnv: string;
};
export type StagingSeedUser = StagingUserSpec & {
  uid: string;
};

export type StagingSeedRecord = {
  path: string;
  data: Record<string, unknown>;
};

export type StagingSeedPlan = {
  seedVersion: string;
  users: StagingUserSpec[];
  records: StagingSeedRecord[];
};

export const STAGING_UAT_USERS: readonly StagingUserSpec[] = [
  { key: "admin", email: STAGING_ADMIN_EMAIL, displayName: "TEOS Staging Admin", passwordEnv: "TEOS_STAGING_ADMIN_PASSWORD" },
  { key: "staff", email: STAGING_STAFF_EMAIL, displayName: "TEOS Staging Staff", passwordEnv: "TEOS_STAGING_STAFF_PASSWORD" },
];
export function assertStagingSeedEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.FIREBASE_PROJECT_ID?.trim() !== STAGING_FIREBASE_PROJECT_ID) {
    throw new Error("Refusing staging UAT seed: FIREBASE_PROJECT_ID must be " + STAGING_FIREBASE_PROJECT_ID + ".");
  }

  if (env.TEOS_ENVIRONMENT?.trim() !== STAGING_ENVIRONMENT) {
    throw new Error("Refusing staging UAT seed: TEOS_ENVIRONMENT must be staging.");
  }
}
export function validateStagingPasswords(env: NodeJS.ProcessEnv): void {
  for (const user of STAGING_UAT_USERS) {
    const password = env[user.passwordEnv]?.trim();
    if (!password || password.length < 12) {
      throw new Error(user.passwordEnv + " must be set to a temporary password of at least 12 characters.");
    }
  }
}

export function stagingSeedMarker(nowIso: string) {
  return {
    environment: STAGING_ENVIRONMENT,
    syntheticData: true,
    seedVersion: STAGING_SEED_VERSION,
    createdBy: STAGING_SEED_CREATED_BY,
    updatedAt: nowIso,
  };
}
export function isStagingSyntheticRecord(data: Record<string, unknown> | undefined | null): boolean {
  return Boolean(
    data?.environment === STAGING_ENVIRONMENT &&
    data.syntheticData === true &&
    data.seedVersion === STAGING_SEED_VERSION &&
    data.createdBy === STAGING_SEED_CREATED_BY,
  );
}

function futureIso(now: Date, days: number): string {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function marker(nowIso: string, createdAt: string) {
  return { ...stagingSeedMarker(nowIso), createdAt };
}
function syntheticDocument(contractorId: string, documentType: string, now: Date, verified: boolean): Record<string, unknown> {
  const nowIso = now.toISOString();
  return {
    ...marker(nowIso, nowIso),
    contractorId,
    documentType,
    docType: documentType,
    documentName: "Synthetic " + documentType + " staging metadata.pdf",
    fileName: "synthetic-" + documentType + "-staging-metadata.pdf",
    originalName: "synthetic-" + documentType + "-staging-metadata.pdf",
    storagePath: "staging/uat/metadata-only/" + contractorId + "/" + documentType + ".pdf",
    fileUrl: "/staging/uat/metadata-only/" + contractorId + "/" + documentType + ".pdf",
    downloadURL: "/staging/uat/metadata-only/" + contractorId + "/" + documentType + ".pdf",
    uploadedAt: nowIso,
    verified,
    verifiedAt: verified ? nowIso : null,
    verifiedBy: verified ? STAGING_SEED_CREATED_BY : null,
    status: verified ? "verified" : "uploaded",
    validationStatus: verified ? "PASS" : "REVIEW",
    expiresAt: verified ? futureIso(now, 180) : null,
    metadataOnly: true,
  };
}
export function buildStagingUatSeedPlan(users: readonly StagingSeedUser[], now = new Date()): StagingSeedPlan {
  const nowIso = now.toISOString();
  const createdAt = nowIso;
  const userRecords: StagingSeedRecord[] = users.map((user) => ({
    path: "users/" + user.uid,
    data: {
      ...marker(nowIso, createdAt),
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      displayName: user.displayName,
      role: user.key,
      status: "active",
      workspaceId: STAGING_WORKSPACE_ID,
      stagingUatUser: true,
    },
  }));

  const canonicalContractor = {
    ...marker(nowIso, createdAt),
    id: STAGING_CANONICAL_CONTRACTOR_ID,
    contractorId: STAGING_CANONICAL_CONTRACTOR_ID,
    companyName: "Synthetic Staging Canonical Contractor Pty Ltd",
    legalName: "Synthetic Staging Canonical Contractor Pty Ltd",
    name: "Synthetic Staging Canonical Contractor Pty Ltd",
    taxpayerName: "Synthetic Staging Canonical Contractor Pty Ltd",
    companyRegistrationNumber: "2099/999999/07",
    registrationNumber: "2099/999999/07",
    csdNumber: "MAAA9999999",
    taxReferenceNumber: "9999999999",
    email: "synthetic.canonical.contractor@invalid.example",
    phone: "+27000000000",
    status: "active",
    workspaceId: STAGING_WORKSPACE_ID,
    capabilities: ["Procurement", "Facilities", "General Services"],
    serviceAreas: ["Gauteng"],
    readinessScore: 100,
    docsMissing: 0,
    complianceApproved: true,
    tenderLockStatus: "READY",
    isTenderLocked: false,
    readinessUpdatedAt: nowIso,
    decisionEvaluatedAt: nowIso,
    logicVersion: "contractor-repository-decision-v1",
    sarsTcsSummary: {
      id: "staging-uat-sars-tcs",
      workspaceId: STAGING_WORKSPACE_ID,
      contractorId: STAGING_CANONICAL_CONTRACTOR_ID,
      taxReferenceNumber: "9999999999",
      registeredTaxpayerName: "Synthetic Staging Canonical Contractor Pty Ltd",
      pinLastFour: "0000",
      pinStatus: "ACTIVE",
      verificationStatus: "VERIFIED_COMPLIANT",
      source: "MANUAL_CAPTURE",
      verifiedAt: nowIso,
      verifiedByUid: STAGING_SEED_CREATED_BY,
      verifiedByName: "Staging Seed",
      recheckDueAt: futureIso(now, 90),
      taxpayerNameMatch: "MATCH",
      taxReferenceMatch: "MATCH",
      registrationNumberMatch: "MATCH",
      contractorIdentityMatch: "MATCH",
      mismatchReasons: [],
      verificationEvidenceHash: "synthetic-staging-evidence-hash",
      createdAt,
      updatedAt: nowIso,
      createdBy: STAGING_SEED_CREATED_BY,
      version: 1,
      auditTrail: [],
    },
  };
  const unresolvedContractor = {
    ...marker(nowIso, createdAt),
    id: STAGING_UNRESOLVED_CONTRACTOR_ID,
    contractorId: STAGING_UNRESOLVED_CONTRACTOR_ID,
    companyName: "Synthetic Staging Unresolved Contractor",
    name: "Synthetic Staging Unresolved Contractor",
    companyRegistrationNumber: "SYNTHETIC-UNRESOLVED",
    registrationNumber: "SYNTHETIC-UNRESOLVED",
    csdNumber: "SYNTHETIC-CSD-UNRESOLVED",
    email: "synthetic.unresolved.contractor@invalid.example",
    phone: "+27000000001",
    status: "onboarding",
    workspaceId: STAGING_WORKSPACE_ID,
    readinessScore: null,
    docsMissing: 2,
    complianceApproved: false,
    tenderLockStatus: "RISK",
    isTenderLocked: true,
    readinessUpdatedAt: null,
    decisionEvaluatedAt: null,
    logicVersion: null,
  };

  const deal = {
    ...marker(nowIso, createdAt),
    id: STAGING_SYNTHETIC_DEAL_ID,
    opportunityDraftId: "staging-uat-rfq-draft",
    type: "opportunity",
    source: "staging-seed",
    title: "Synthetic Staging RFQ - Facilities Support",
    name: "Synthetic Staging RFQ - Facilities Support",
    companyId: "unassigned",
    contractorId: null,
    contractorName: null,
    status: "draft",
    stage: "lead",
    workflowStatus: "MATCHING_REQUIRED",
    workspaceId: STAGING_WORKSPACE_ID,
    value: 1000,
    estimatedDealValue: 1000,
    currency: "ZAR",
    tenderNumber: "STAGING-RFQ-0001",
    rfqNumber: "STAGING-RFQ-0001",
    clientName: "Synthetic Staging Client",
    issuingAuthority: "Synthetic Staging Client",
    municipalityName: "Synthetic Municipality",
    department: "Synthetic Facilities Department",
    province: "Gauteng",
    category: "Facilities",
    description: "Synthetic RFQ metadata only. No uploaded file and no real client data.",
    closingDate: futureIso(now, 30),
    deadline: futureIso(now, 30),
    createdBy: STAGING_SEED_CREATED_BY,
    createdByUid: users.find((user) => user.key === "admin")?.uid ?? STAGING_SEED_CREATED_BY,
    opportunityExecution: {
      currentPhase: "MATCHING_REQUIRED",
      requirementsReviewed: true,
      matchingCompleted: true,
      requirements: {
        reviewed: true,
        reviewedAt: nowIso,
        reviewedByUid: users.find((user) => user.key === "admin")?.uid ?? STAGING_SEED_CREATED_BY,
        rfqNumber: "STAGING-RFQ-0001",
        clientIssuer: "Synthetic Staging Client",
        municipalityOrOrganOfState: "Synthetic Municipality",
        department: "Synthetic Facilities Department",
        closingDateTime: futureIso(now, 30),
        compulsoryBriefing: false,
        submissionMethod: "portal",
        serviceCategory: "Facilities",
        location: "Gauteng",
        cidbRequirement: null,
        csdRequirement: true,
        taxRequirement: true,
        sarsVerificationRequired: true,
        bbbeeRequirement: true,
        coidaRequirement: true,
        bankingRequirement: true,
        compulsoryReturnables: ["Tax Compliance", "CSD", "B-BBEE", "COIDA", "Bank confirmation"],
        boqPricingSchedulePresent: false,
        formsRequiringCompletion: ["SBD forms"],
        annexuresAndAmendments: [],
        signatureRequired: true,
      },
    },
    documents: [{ id: "staging-rfq-a", documentType: "rfq", name: "synthetic-staging-rfq-a.pdf", metadataOnly: true }],
  };
  const records: StagingSeedRecord[] = [
    ...userRecords,
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID, data: canonicalContractor },
    { path: "contractors/" + STAGING_UNRESOLVED_CONTRACTOR_ID, data: unresolvedContractor },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/taxClearance", data: { ...syntheticDocument(STAGING_CANONICAL_CONTRACTOR_ID, "taxClearance", now, true), taxDocumentCategory: "TAX_COMPLIANCE_STATUS", taxComplianceCapable: true } },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/csd", data: syntheticDocument(STAGING_CANONICAL_CONTRACTOR_ID, "csd", now, true) },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/bbbee", data: syntheticDocument(STAGING_CANONICAL_CONTRACTOR_ID, "bbbee", now, true) },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/coida", data: syntheticDocument(STAGING_CANONICAL_CONTRACTOR_ID, "coida", now, true) },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/documents/bankConfirmation", data: syntheticDocument(STAGING_CANONICAL_CONTRACTOR_ID, "bankConfirmation", now, true) },
    { path: "contractors/" + STAGING_CANONICAL_CONTRACTOR_ID + "/sarsTcs/staging-uat-sars-tcs", data: { ...(canonicalContractor.sarsTcsSummary as Record<string, unknown>), ...marker(nowIso, createdAt) } },
    { path: "contractors/" + STAGING_UNRESOLVED_CONTRACTOR_ID + "/documents/taxClearance", data: { ...syntheticDocument(STAGING_UNRESOLVED_CONTRACTOR_ID, "taxClearance", now, false), taxDocumentCategory: "UNKNOWN_TAX_DOCUMENT", taxComplianceCapable: false } },
    { path: "contractors/" + STAGING_UNRESOLVED_CONTRACTOR_ID + "/documents/csd", data: syntheticDocument(STAGING_UNRESOLVED_CONTRACTOR_ID, "csd", now, false) },
    { path: "deals/" + STAGING_SYNTHETIC_DEAL_ID, data: deal },
    { path: "deals/" + STAGING_SYNTHETIC_DEAL_ID + "/activity/staging-seed-created", data: { ...marker(nowIso, createdAt), type: "created", message: "Synthetic staging RFQ opportunity prepared", performedByEmail: STAGING_ADMIN_EMAIL, createdAt } },
  ];

  return { seedVersion: STAGING_SEED_VERSION, users: [...STAGING_UAT_USERS], records };
}

export function buildStagingResetRecordPaths(users: readonly StagingSeedUser[]): string[] {
  return buildStagingUatSeedPlan(users).records.map((record) => record.path).reverse();
}
