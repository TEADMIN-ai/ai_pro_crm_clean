import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { HYGIENE_COLLECTIONS } from "@/lib/hygiene/hygieneService";
import { QS_COLLECTIONS } from "@/lib/qs/collections";

type SeedAction = "seed" | "cleanup";
type QaRole = "admin" | "manager" | "staff" | "driver" | "contractor" | "ROAR_CARS_STAFF";

type QaUserSpec = {
  key: string;
  role: QaRole;
  name: string;
  passwordEnv: string;
  contractorId?: string;
};

type SeededUser = QaUserSpec & {
  uid: string;
  email: string;
  authCreated: boolean;
};

type QaDocTarget = {
  collection: string;
  id: string;
  subcollection?: string;
  subId?: string;
};

const CREATED_BY = "scripts/qaAcceptanceSeed.ts";
const QA_NAMESPACE = "v1";
const DEFAULT_EMAIL_DOMAIN = "qa.torqueempire.local";
const VERIFIED_CONTRACTOR_ID = "qa-v1-contractor-verified";
const INCOMPLETE_CONTRACTOR_ID = "qa-v1-contractor-incomplete";

const QA_USERS: QaUserSpec[] = [
  { key: "admin", role: "admin", name: "QA Admin", passwordEnv: "TE_QA_ADMIN_PASSWORD" },
  { key: "manager", role: "manager", name: "QA Manager", passwordEnv: "TE_QA_MANAGER_PASSWORD" },
  { key: "staff", role: "staff", name: "QA Staff", passwordEnv: "TE_QA_STAFF_PASSWORD" },
  { key: "driver", role: "driver", name: "QA Driver", passwordEnv: "TE_QA_DRIVER_PASSWORD" },
  {
    key: "contractor",
    role: "contractor",
    name: "QA Contractor",
    passwordEnv: "TE_QA_CONTRACTOR_PASSWORD",
    contractorId: VERIFIED_CONTRACTOR_ID,
  },
  { key: "roar", role: "ROAR_CARS_STAFF", name: "QA Roar Cars Staff", passwordEnv: "TE_QA_ROAR_PASSWORD" },
];

const REQUIRED_CONTRACTOR_DOCS = ["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation"] as const;

function getAction(): SeedAction {
  const raw = process.argv[2]?.trim();
  if (raw === "seed" || raw === "cleanup") return raw;
  throw new Error("Usage: tsx scripts/qaAcceptanceSeed.ts <seed|cleanup>");
}

function getEnvironmentName(): string {
  return process.env.TE_QA_ENVIRONMENT?.trim() || "local";
}

function assertSafetyGate(action: SeedAction, environment: string): void {
  const expected = action === "seed" ? "seed-v1-qa" : "cleanup-v1-qa";
  if (process.env.TE_QA_SEED_CONFIRM !== expected) {
    throw new Error(`Set TE_QA_SEED_CONFIRM=${expected} before running ${action}.`);
  }

  if (environment.toLowerCase() === "production" && process.env.TE_QA_ALLOW_PRODUCTION !== "true") {
    throw new Error("Production QA seeding requires TE_QA_ALLOW_PRODUCTION=true.");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function futureMillis(days: number): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

function qaMetadata(environment: string) {
  return {
    qa: true,
    environment,
    qaNamespace: QA_NAMESPACE,
    createdBy: CREATED_BY,
    createdAt: nowIso(),
    safeToDelete: true,
  };
}

function qaEmail(key: string): string {
  const domain = process.env.TE_QA_EMAIL_DOMAIN?.trim() || DEFAULT_EMAIL_DOMAIN;
  return `qa-v1-${key}@${domain}`.toLowerCase();
}

function deterministicUid(key: string): string {
  return `qa-v1-${key}`;
}

function isQaSafeRecord(data: FirebaseFirestore.DocumentData | undefined, environment: string): boolean {
  return (
    data?.qa === true &&
    data.safeToDelete === true &&
    data.environment === environment &&
    data.createdBy === CREATED_BY &&
    data.qaNamespace === QA_NAMESPACE
  );
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    ) as T;
  }

  return value;
}

async function setQaDoc(
  target: QaDocTarget,
  payload: Record<string, unknown>,
  environment: string,
): Promise<void> {
  const db = getFirebaseAdmin();
  const ref = target.subcollection && target.subId
    ? db.collection(target.collection).doc(target.id).collection(target.subcollection).doc(target.subId)
    : db.collection(target.collection).doc(target.id);
  const snapshot = await ref.get();

  if (snapshot.exists && !isQaSafeRecord(snapshot.data(), environment)) {
    throw new Error(`Refusing to overwrite non-QA record: ${ref.path}`);
  }

  await ref.set(stripUndefined({ ...payload, ...qaMetadata(environment), updatedAt: nowIso() }));
}

async function deleteQaDoc(target: QaDocTarget, environment: string): Promise<boolean> {
  const db = getFirebaseAdmin();
  const ref = target.subcollection && target.subId
    ? db.collection(target.collection).doc(target.id).collection(target.subcollection).doc(target.subId)
    : db.collection(target.collection).doc(target.id);
  const snapshot = await ref.get();

  if (!snapshot.exists) return false;
  if (!isQaSafeRecord(snapshot.data(), environment)) {
    throw new Error(`Refusing to delete non-QA record: ${ref.path}`);
  }

  await ref.delete();
  return true;
}

async function ensureQaAuthUser(spec: QaUserSpec, environment: string): Promise<SeededUser> {
  const email = qaEmail(spec.key);
  const fallbackUser: SeededUser = {
    ...spec,
    uid: deterministicUid(spec.key),
    email,
    authCreated: false,
  };

  if (process.env.TE_QA_CREATE_AUTH_USERS !== "true") {
    return fallbackUser;
  }

  const password = process.env[spec.passwordEnv]?.trim();
  if (!password || password.length < 8) {
    throw new Error(`${spec.passwordEnv} must be set to at least 8 characters when TE_QA_CREATE_AUTH_USERS=true.`);
  }

  const auth = getAuth();
  let user: UserRecord;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({
      email,
      password,
      displayName: spec.name,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, stripUndefined({
    role: spec.role,
    contractorId: spec.contractorId ?? null,
    qa: true,
    environment,
    qaNamespace: QA_NAMESPACE,
    safeToDelete: true,
  }));

  return {
    ...spec,
    uid: user.uid,
    email,
    authCreated: true,
  };
}

async function seedQaUsers(environment: string): Promise<SeededUser[]> {
  const users: SeededUser[] = [];
  for (const spec of QA_USERS) {
    const user = await ensureQaAuthUser(spec, environment);
    await setQaDoc(
      { collection: "users", id: user.uid },
      {
        uid: user.uid,
        name: spec.name,
        email: user.email,
        role: spec.role,
        contractorId: spec.contractorId ?? null,
        disabled: false,
      },
      environment,
    );
    users.push(user);
  }
  return users;
}

function contractorDocument(
  contractorId: string,
  documentType: (typeof REQUIRED_CONTRACTOR_DOCS)[number] | "csd" | "cidb",
  verified: boolean,
  environment: string,
  overrides: Record<string, unknown> = {},
) {
  const uploadedAt = Date.now();
  const label = documentType === "taxClearance" ? "Tax Clearance" : documentType.toUpperCase();
  return stripUndefined({
    contractorId,
    documentType,
    docType: documentType,
    documentName: `${label} QA Evidence.pdf`,
    fileName: `${documentType}-qa-evidence.pdf`,
    originalName: `${documentType}-qa-evidence.pdf`,
    filename: `${documentType}-qa-evidence.pdf`,
    storagePath: `qa/${environment}/contractors/${contractorId}/${documentType}.pdf`,
    fileUrl: `/qa/${environment}/contractors/${contractorId}/${documentType}.pdf`,
    downloadURL: `/qa/${environment}/contractors/${contractorId}/${documentType}.pdf`,
    uploadedAt,
    createdAt: uploadedAt,
    updatedAt: uploadedAt,
    extractedAt: uploadedAt,
    verified,
    verifiedAt: verified ? uploadedAt : null,
    verifiedBy: verified ? CREATED_BY : null,
    verificationMethod: verified ? "MANUAL" : undefined,
    verificationStatus: verified ? "VERIFIED_MANUAL" : undefined,
    status: verified ? "verified" : "uploaded",
    validationStatus: verified ? "PASS" : "REVIEW",
    manualDecisionAvailable: !verified,
    reviewReason: verified ? null : "QA seed intentionally requires manual review.",
    confidenceScore: verified ? 96 : 42,
    complianceScore: verified ? 100 : 25,
    extractionMethod: "pdf-parse",
    extractionSource: verified ? "PDF_TEXT" : "EMPTY",
    extractedTextLength: verified ? 420 : 0,
    directTextLength: verified ? 420 : 0,
    ocrTextLength: 0,
    pageCount: verified ? 2 : 0,
    expiresAt: verified ? futureMillis(180) : undefined,
    expiryAlert: verified ? "none" : undefined,
    ...qaMetadata(environment),
    ...overrides,
  });
}

async function seedContractors(environment: string, users: SeededUser[]): Promise<void> {
  const contractorUser = users.find((user) => user.role === "contractor");
  const base = {
    tier: "basic",
    submissionsUsed: 0,
    submissionsLimit: 5,
    createdAt: Date.now(),
  };

  await setQaDoc(
    { collection: "contractors", id: INCOMPLETE_CONTRACTOR_ID },
    {
      ...base,
      id: INCOMPLETE_CONTRACTOR_ID,
      contractorId: INCOMPLETE_CONTRACTOR_ID,
      companyName: "QA v1 Incomplete Documents Contractor",
      name: "QA v1 Incomplete Documents Contractor",
      companyRegistrationNumber: "QA-INCOMPLETE-2026",
      registrationNumber: "QA-INCOMPLETE-2026",
      contactPerson: "QA Incomplete Contact",
      email: "qa-v1-contractor-incomplete@example.invalid",
      phone: "+27000000001",
      status: "Onboarding",
      complianceApproved: false,
      taxPin: "QA-TAX-REVIEW",
      csdNumber: "QA-CSD-REVIEW",
    },
    environment,
  );

  await setQaDoc(
    { collection: "contractors", id: VERIFIED_CONTRACTOR_ID },
    {
      ...base,
      id: VERIFIED_CONTRACTOR_ID,
      contractorId: VERIFIED_CONTRACTOR_ID,
      authUid: contractorUser?.uid ?? null,
      companyName: "QA v1 Verified Documents Contractor",
      name: "QA v1 Verified Documents Contractor",
      companyRegistrationNumber: "QA-VERIFIED-2026",
      registrationNumber: "QA-VERIFIED-2026",
      contactPerson: "QA Verified Contact",
      email: contractorUser?.email ?? "qa-v1-contractor@example.invalid",
      phone: "+27000000002",
      status: "Pending Review",
      complianceApproved: false,
      taxPin: "QA-TAX-VERIFIED",
      csdNumber: "QA-CSD-VERIFIED",
    },
    environment,
  );

  await setQaDoc(
    { collection: "contractors", id: INCOMPLETE_CONTRACTOR_ID, subcollection: "documents", subId: "cipc" },
    contractorDocument(INCOMPLETE_CONTRACTOR_ID, "cipc", true, environment),
    environment,
  );
  await setQaDoc(
    { collection: "contractors", id: INCOMPLETE_CONTRACTOR_ID, subcollection: "documents", subId: "taxClearance" },
    contractorDocument(INCOMPLETE_CONTRACTOR_ID, "taxClearance", false, environment, {
      taxDocumentCategory: "UNKNOWN_TAX_DOCUMENT",
      taxComplianceCapable: false,
      readinessImpactReason: "QA review-required tax evidence.",
    }),
    environment,
  );
  await setQaDoc(
    { collection: "contractors", id: INCOMPLETE_CONTRACTOR_ID, subcollection: "documents", subId: "csd" },
    contractorDocument(INCOMPLETE_CONTRACTOR_ID, "csd", false, environment),
    environment,
  );

  for (const documentType of REQUIRED_CONTRACTOR_DOCS) {
    await setQaDoc(
      { collection: "contractors", id: VERIFIED_CONTRACTOR_ID, subcollection: "documents", subId: documentType },
      contractorDocument(VERIFIED_CONTRACTOR_ID, documentType, true, environment, documentType === "taxClearance" ? {
        taxDocumentCategory: "TAX_COMPLIANCE_STATUS",
        taxDocumentPurpose: "ACTIVE_TAX_COMPLIANCE_PROOF",
        taxClassificationConfidence: 98,
        taxComplianceCapable: true,
        taxSupportingOnly: false,
      } : {}),
      environment,
    );
  }
  await setQaDoc(
    { collection: "contractors", id: VERIFIED_CONTRACTOR_ID, subcollection: "documents", subId: "csd" },
    contractorDocument(VERIFIED_CONTRACTOR_ID, "csd", true, environment),
    environment,
  );
  await setQaDoc(
    { collection: "contractors", id: VERIFIED_CONTRACTOR_ID, subcollection: "documents", subId: "cidb" },
    contractorDocument(VERIFIED_CONTRACTOR_ID, "cidb", true, environment),
    environment,
  );

  await recalculateContractorCompliance(getFirebaseAdmin(), INCOMPLETE_CONTRACTOR_ID);
  await recalculateContractorCompliance(getFirebaseAdmin(), VERIFIED_CONTRACTOR_ID);
}

async function seedHygiene(environment: string, users: SeededUser[]): Promise<void> {
  const driver = users.find((user) => user.role === "driver");
  const timestamp = nowIso();
  const clientId = "qa-v1-hygiene-client";
  const siteId = "qa-v1-hygiene-site";
  const collectionId = "qa-v1-hygiene-collection";
  const manifestId = "qa-v1-hygiene-manifest";

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.clients, id: clientId }, {
    clientId,
    clientName: "QA v1 Hygiene Client",
    clientType: "Hygiene Client",
    companyRegistration: "QA-HYG-2026",
    primaryContactName: "QA Hygiene Contact",
    primaryContactPhone: "+27000000003",
    primaryContactEmail: "qa-v1-hygiene@example.invalid",
    billingContact: "QA Hygiene Billing",
    contractStartDate: timestamp.slice(0, 10),
    contractEndDate: "2026-12-31",
    serviceFrequency: "Weekly",
    collectionDay: "Friday",
    collectionWindow: "09:00-12:00",
    paymentStatus: "Paid",
    status: "Active",
    monthlyRevenue: 2100,
  }, environment);

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.sites, id: siteId }, {
    siteId,
    clientId,
    siteName: "QA v1 Hygiene Site",
    address: "QA Acceptance Site",
    suburb: "Roodepoort",
    city: "Johannesburg",
    contactPerson: "QA Hygiene Contact",
    contactPhone: "+27000000003",
    binCount: 3,
    binSize: "12L",
    serviceFrequency: "Weekly",
    accessNotes: "QA seeded safe workflow site.",
    lastServiceDate: null,
    nextServiceDate: timestamp.slice(0, 10),
    status: "Active",
  }, environment);

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.assets, id: "qa-v1-hygiene-bin-001" }, {
    assetId: "qa-v1-hygiene-bin-001",
    clientId,
    siteId,
    binSize: "12L",
    binType: "Sanitary hygiene bin",
    locationDescription: "QA reception service point",
    status: "Active",
    installDate: timestamp.slice(0, 10),
    lastServiceDate: null,
    nextServiceDate: timestamp.slice(0, 10),
    condition: "Serviceable",
    notes: "QA acceptance seed asset.",
  }, environment);

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.collections, id: collectionId }, {
    collectionId,
    clientId,
    siteId,
    scheduledDate: timestamp.slice(0, 10),
    scheduledTimeWindow: "09:00-12:00",
    assignedDriver: driver?.name ?? "QA Driver",
    assignedUserIds: driver ? [driver.uid] : [],
    vehicleRegistration: "QA 10 GP",
    vehicleName: "QA Nissan NP200",
    status: "Scheduled",
    arrivalTime: null,
    departureTime: null,
    completedAt: null,
    manifestId,
    evidencePhotoIds: [],
    clientSignatureStatus: "Pending",
    notes: "QA acceptance collection for driver workflow.",
    workflowSteps: [
      "Start collection",
      "Confirm site arrival",
      "Capture before-service photo",
      "Record bin count",
      "Upload evidence photos",
      "Capture client signature",
      "Complete collection",
      "Generate/attach manifest",
    ].map((label, index) => ({ stepId: `qa-step-${index + 1}`, label, status: "Pending" })),
  }, environment);

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.manifests, id: manifestId }, {
    manifestId,
    collectionId,
    clientId,
    siteId,
    generatorRegistration: "QA-GPG-2026",
    transportRegistration: "QA-GPT-2026",
    wasteClassification: "HW19",
    wasteType: "Sanitary/Feminine Hygiene Waste",
    quantity: 3,
    unit: "12L bins",
    collectionDate: timestamp.slice(0, 10),
    collectedBy: driver?.name ?? "QA Driver",
    vehicleRegistration: "QA 10 GP",
    disposalFacility: "QA disposal facility pending",
    disposalDate: null,
    disposalCertificateNo: "QA disposal certificate pending",
    status: "Generated",
  }, environment);

  await setQaDoc({ collection: HYGIENE_COLLECTIONS.driverLogs, id: "qa-v1-hygiene-driver-log" }, {
    driverLogId: "qa-v1-hygiene-driver-log",
    date: timestamp.slice(0, 10),
    driverName: driver?.name ?? "QA Driver",
    vehicleRegistration: "QA 10 GP",
    startKm: null,
    endKm: null,
    fuel: "QA fuel pending",
    signatureStatus: "Pending",
    linkedCollectionIds: [collectionId],
  }, environment);
}

async function seedVehicleFinance(environment: string): Promise<void> {
  const timestamp = nowIso();
  const customerId = "qa-v1-vf-customer";
  const applicationId = "qa-v1-vf-application";
  const vehicleId = "qa-v1-roar-vehicle";

  await setQaDoc({ collection: "vehicleFinanceCustomers", id: customerId }, {
    customerId,
    firstName: "QA",
    lastName: "Finance Applicant",
    idNumber: "8001015009087",
    phone: "+27000000004",
    email: "qa-v1-finance@example.invalid",
    address: "QA Finance Address",
    employer: "QA Employer",
    monthlyIncome: 32000,
  }, environment);

  await setQaDoc({ collection: "inventory", id: vehicleId }, {
    id: vehicleId,
    firestoreId: vehicleId,
    recordType: "vehicle",
    sourceVehicleId: vehicleId,
    canonicalKey: `roarcarssa.com|${vehicleId}`,
    contentHash: "qa-v1-content-hash",
    isAvailable: true,
    imageStatus: "VALID",
    originalImageUrl: null,
    firstSyncedAt: timestamp,
    lastSeenAt: timestamp,
    lastSyncedAt: timestamp,
    unavailableSince: null,
    syncRunId: "qa-v1-seed",
    title: "2024 QA Roar Cars Test Vehicle",
    make: "Toyota",
    model: "Corolla Quest",
    year: 2024,
    price: 249900,
    priceNumber: 249900,
    mileage: 18500,
    mileageNumber: 18500,
    transmission: "Automatic",
    fuelType: "Petrol",
    bodyType: "Sedan",
    imageUrl: "/images/roar-cars-placeholder.svg",
    listingUrl: "https://roarcarssa.com/qa-v1-test-vehicle",
    status: "ACTIVE",
    source: "roarcarssa.com",
  }, environment);

  await setQaDoc({ collection: "vehicleFinanceApplications", id: applicationId }, {
    applicationId,
    customerId,
    vehicleId,
    vehicleInventoryId: vehicleId,
    vehicleTitle: "2024 QA Roar Cars Test Vehicle",
    vehiclePrice: 249900,
    vehicleYear: 2024,
    vehicleMileage: 18500,
    vehicleImageUrl: "/images/roar-cars-placeholder.svg",
    vehicleListingUrl: "https://roarcarssa.com/qa-v1-test-vehicle",
    inventorySource: "roarcarssa.com",
    dealerName: "Roar Cars QA",
    dealValue: 249900,
    applicationStatus: "IN_REVIEW",
    fraudScore: 18,
    verificationStatus: "REVIEW",
  }, environment);

  await setQaDoc({ collection: "vehicleFinanceAssessments", id: applicationId }, {
    applicationId,
    identityScore: 85,
    incomeScore: 78,
    bankScore: 74,
    documentIntegrityScore: 70,
    overallFraudScore: 18,
    riskLevel: "LOW",
    verificationStatus: "REVIEW",
    riskReasons: ["QA assessment seeded for acceptance verification"],
  }, environment);
}

async function seedQs(environment: string, users: SeededUser[]): Promise<void> {
  const timestamp = nowIso();
  const staff = users.find((user) => user.role === "staff") ?? users[0];
  const materialId = "qa-v1-material-cement";
  const estimateId = "qa-v1-qs-estimate";
  const supplierId = "qa-v1-supplier";
  const offerId = "qa-v1-supplier-offer";

  await setQaDoc({ collection: QS_COLLECTIONS.materials, id: materialId }, {
    materialId,
    name: "QA v1 Cement 50kg",
    normalizedName: "qa v1 cement 50kg",
    description: "QA acceptance material.",
    categoryId: "qa-v1-category-building",
    unit: "bag",
    vatApplicable: true,
    averageMarketPrice: 98,
    currentPrice: 95,
    status: "active",
    tags: ["qa", "acceptance"],
    searchKeywords: ["qa", "cement", "50kg"],
  }, environment);

  await setQaDoc({ collection: QS_COLLECTIONS.qsSuppliers, id: supplierId }, {
    supplierId,
    supplierName: "QA v1 Supplier",
    tradingName: "QA Supplier Trading",
    companyRegistrationNumber: "QA-SUP-2026",
    vatNumber: "QA-VAT-2026",
    bbbeeLevel: "Level 1",
    contactPerson: "QA Supplier Contact",
    phone: "+27000000005",
    email: "qa-v1-supplier@example.invalid",
    website: "https://example.invalid/qa-supplier",
    branches: [{
      branchId: "qa-v1-supplier-branch",
      branchName: "QA Gauteng Branch",
      province: "Gauteng",
      city: "Johannesburg",
      deliveryRadiusKm: 50,
      standardDeliveryFee: 350,
      averageLeadTimeDays: 2,
    }],
    deliveryAreas: ["Gauteng"],
    productCategories: ["Concrete", "Aggregates"],
    paymentTerms: "QA 30 days",
    warrantyNotes: "QA acceptance only.",
    isPreferredSupplier: true,
    isSponsoredSupplier: false,
    supplierSubscriptionTier: "none",
    leadFeeEnabled: false,
    referralCommissionEnabled: false,
    featuredPlacementEnabled: false,
    status: "active",
    version: 1,
    qualityScore: 88,
    reliabilityScore: 90,
    deliveryScore: 84,
    priceCompetitivenessScore: 92,
    stockAvailabilityScore: 86,
    overallSupplierScore: 88,
  }, environment);

  await setQaDoc({ collection: QS_COLLECTIONS.qsSupplierOffers, id: offerId }, {
    offerId,
    supplierId,
    materialId,
    materialName: "QA v1 Cement 50kg",
    category: "Concrete",
    unit: "bag",
    unitPriceExVat: 95,
    vatRate: 0.15,
    stockStatus: "inStock",
    availableQuantity: 500,
    leadTimeDays: 2,
    deliveryFee: 350,
    validFrom: timestamp,
    validUntil: "2026-12-31T23:59:59.000Z",
    qualityGrade: "SABS",
    brand: "QA Cement",
    warranty: "QA acceptance only",
    notes: "QA seeded supplier offer.",
    pricingSource: "manual",
    status: "active",
    version: 1,
  }, environment);

  await setQaDoc({ collection: QS_COLLECTIONS.qsEstimates, id: estimateId }, {
    estimateId,
    sourceBoqId: "qa-v1-boq",
    projectName: "QA v1 Acceptance Estimate",
    status: "quoteReady",
    version: 1,
    createdByUid: staff?.uid ?? null,
    updatedByUid: staff?.uid ?? null,
    assumptions: {
      vatRate: 0.15,
      vatEnabled: true,
      overheadPercentage: 10,
      waste: { mode: "percentage", value: 3 },
      transport: { mode: "fixed", value: 350 },
      plant: { mode: "fixed", value: 0 },
      labourRates: { Concrete: { ratePerHour: 180, hoursPerUnit: 0.25 } },
      profitPercentage: 12,
      riskPercentage: 5,
      lowConfidenceRiskPercentage: 8,
      missingPricingRiskPercentage: 12,
    },
    lines: [{
      estimateLineId: "qa-v1-estimate-line-001",
      boqLineItemId: "qa-v1-boq-line-001",
      boqDocumentId: "qa-v1-boq",
      description: "QA cement supply",
      trade: "Concrete",
      unit: "bag",
      quantity: 20,
      matchedMaterialIds: [materialId],
      materialUnitCost: 95,
      materialTotal: 1900,
      labourRate: 180,
      labourHours: 5,
      labourTotal: 900,
      plantEquipmentCost: 0,
      transportAllowance: 350,
      wasteAllowance: 57,
      overheadAmount: 320.7,
      profitAmount: 423.68,
      riskAmount: 176.56,
      lineSubtotal: 4127.94,
      vatAmount: 619.19,
      lineTotal: 4747.13,
      confidenceScore: 92,
      warnings: [],
      pricingSource: "manual",
    }],
    breakdown: {
      materialCost: 1900,
      labourCost: 900,
      plantAllowance: 0,
      transportAllowance: 350,
      wasteAllowance: 57,
      overhead: 320.7,
      profit: 423.68,
      riskAllowance: 176.56,
      subtotalExVat: 4127.94,
      vatAmount: 619.19,
      totalInclVat: 4747.13,
    },
    totalEstimatedProjectValue: 4747.13,
    confidenceScore: 92,
    missingPricingWarnings: [],
    quoteReadinessStatus: "quoteReady",
    sourceItemCount: 1,
  }, environment);
}

function cleanupTargets(users: SeededUser[]): QaDocTarget[] {
  const contractorTargets: QaDocTarget[] = [
    { collection: "contractors", id: INCOMPLETE_CONTRACTOR_ID },
    { collection: "contractors", id: VERIFIED_CONTRACTOR_ID },
    ...["cipc", "taxClearance", "csd"].map((subId) => ({
      collection: "contractors",
      id: INCOMPLETE_CONTRACTOR_ID,
      subcollection: "documents",
      subId,
    })),
    ...[...REQUIRED_CONTRACTOR_DOCS, "csd", "cidb"].map((subId) => ({
      collection: "contractors",
      id: VERIFIED_CONTRACTOR_ID,
      subcollection: "documents",
      subId,
    })),
  ];

  return [
    ...contractorTargets,
    ...users.map((user) => ({ collection: "users", id: user.uid })),
    { collection: HYGIENE_COLLECTIONS.clients, id: "qa-v1-hygiene-client" },
    { collection: HYGIENE_COLLECTIONS.sites, id: "qa-v1-hygiene-site" },
    { collection: HYGIENE_COLLECTIONS.assets, id: "qa-v1-hygiene-bin-001" },
    { collection: HYGIENE_COLLECTIONS.collections, id: "qa-v1-hygiene-collection" },
    { collection: HYGIENE_COLLECTIONS.manifests, id: "qa-v1-hygiene-manifest" },
    { collection: HYGIENE_COLLECTIONS.driverLogs, id: "qa-v1-hygiene-driver-log" },
    { collection: "vehicleFinanceCustomers", id: "qa-v1-vf-customer" },
    { collection: "vehicleFinanceApplications", id: "qa-v1-vf-application" },
    { collection: "vehicleFinanceAssessments", id: "qa-v1-vf-application" },
    { collection: "inventory", id: "qa-v1-roar-vehicle" },
    { collection: QS_COLLECTIONS.materials, id: "qa-v1-material-cement" },
    { collection: QS_COLLECTIONS.qsSuppliers, id: "qa-v1-supplier" },
    { collection: QS_COLLECTIONS.qsSupplierOffers, id: "qa-v1-supplier-offer" },
    { collection: QS_COLLECTIONS.qsEstimates, id: "qa-v1-qs-estimate" },
  ];
}

async function cleanupQaUsers(environment: string): Promise<number> {
  if (process.env.TE_QA_DELETE_AUTH_USERS !== "true") return 0;
  const auth = getAuth();
  let deleted = 0;

  for (const spec of QA_USERS) {
    const email = qaEmail(spec.key);
    let user: UserRecord | null = null;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = null;
    }

    if (!user) continue;
    if (!isQaSafeRecord(user.customClaims, environment)) {
      throw new Error(`Refusing to delete Auth user without QA claims: ${email}`);
    }

    await auth.deleteUser(user.uid);
    deleted += 1;
  }

  return deleted;
}

async function seed(environment: string): Promise<void> {
  const users = await seedQaUsers(environment);
  await seedContractors(environment, users);
  await seedHygiene(environment, users);
  await seedVehicleFinance(environment);
  await seedQs(environment, users);

  console.log(JSON.stringify({
    status: "seeded",
    environment,
    authUsersCreated: users.filter((user) => user.authCreated).length,
    users: users.map((user) => ({ key: user.key, role: user.role, uid: user.uid, email: user.email })),
    records: cleanupTargets(users).length,
  }, null, 2));
}

async function cleanup(environment: string): Promise<void> {
  const users: SeededUser[] = QA_USERS.map((spec) => ({
    ...spec,
    uid: deterministicUid(spec.key),
    email: qaEmail(spec.key),
    authCreated: false,
  }));

  if (process.env.TE_QA_CREATE_AUTH_USERS === "true" || process.env.TE_QA_DELETE_AUTH_USERS === "true") {
    for (const spec of QA_USERS) {
      try {
        const authUser = await getAuth().getUserByEmail(qaEmail(spec.key));
        const existing = users.find((user) => user.key === spec.key);
        if (existing) existing.uid = authUser.uid;
      } catch {
        // Firestore-only cleanup still uses deterministic placeholder ids.
      }
    }
  }

  let deleted = 0;
  for (const target of cleanupTargets(users).reverse()) {
    if (await deleteQaDoc(target, environment)) deleted += 1;
  }

  const deletedAuthUsers = await cleanupQaUsers(environment);
  console.log(JSON.stringify({ status: "cleaned", environment, deletedFirestoreRecords: deleted, deletedAuthUsers }, null, 2));
}

async function main(): Promise<void> {
  const action = getAction();
  const environment = getEnvironmentName();
  assertSafetyGate(action, environment);

  if (action === "seed") {
    await seed(environment);
  } else {
    await cleanup(environment);
  }
}

main().catch((error) => {
  console.error("[qa-acceptance-seed] failed", error);
  process.exit(1);
});
