import type { VehicleFinanceBankName } from "@/lib/vehicle-finance/classification/bankStatementClassifier";

export const VEHICLE_FINANCE_DOCUMENT_TYPES = [
  "saIdDocument",
  "greenIdBook",
  "smartIdCard",
  "driversLicense",
  "payslip",
  "bankStatement",
  "proofOfAddress",
  "employmentLetter",
] as const;

export type VehicleFinanceDocumentType = (typeof VEHICLE_FINANCE_DOCUMENT_TYPES)[number];

export const VEHICLE_FINANCE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type VehicleFinanceRiskLevel = (typeof VEHICLE_FINANCE_RISK_LEVELS)[number];

export type VehicleFinanceCustomer = {
  customerId: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  employer: string;
  monthlyIncome: number;
  createdAt: string;
  operatingDivision?: string | null;
};

export type VehicleFinanceApplication = {
  applicationId: string;
  customerId: string;
  vehicleId: string;
  clientSubmissionId?: string | null;
  vehicleInventoryId?: string | null;
  vehicleTitle?: string | null;
  vehiclePrice?: number | null;
  vehicleYear?: number | null;
  vehicleMileage?: number | null;
  vehicleImageUrl?: string | null;
  vehicleListingUrl?: string | null;
  inventorySource?: string | null;
  dealerName: string;
  dealValue: number;
  applicationStatus: "NEW" | "IN_REVIEW" | "VERIFIED" | "FLAGGED" | "REJECTED";
  fraudScore: number;
  verificationStatus: "PENDING" | "REVIEW" | "VERIFIED" | "FLAGGED";
  isDeleted?: boolean;
  archived?: boolean;
  inactive?: boolean;
  createdByUid?: string | null;
  createdVia?: "web" | "email" | "api" | "system";
  createdAt: string;
  updatedAt: string;
  operatingDivision?: string | null;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];
  assignedConsultantUid?: string | null;
  assignedConsultantName?: string | null;
  assignedSalesManagerUid?: string | null;
  assignedSalesManagerName?: string | null;
  assignedFinanceManagerUid?: string | null;
  assignedFinanceManagerName?: string | null;
  assignmentTimestamp?: string | null;
  assignmentHistory?: Array<{
    timestamp: string;
    actorId: string | null;
    actorName: string | null;
    reason: string;
    previousValue: Record<string, string | null>;
    nextValue: Record<string, string | null>;
  }>;
  documentChecklistCompletionPercentage?: number;
  documentChecklistOutstandingCount?: number;
  notificationCount?: number;
  unreadNotificationCount?: number;
};

export type VehicleFinanceDocumentAnalysis = {
  documentType: VehicleFinanceDocumentType;
  extractedTextLength: number;
  directTextLength: number;
  ocrTextLength: number;
  pageCount: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY";
  documentIntegrityScore: number;
  fraudIndicators: string[];
  integrityNotes: string[];
  textQualityAssessment?: VehicleFinanceTextQualityAssessment | null;
  documentClassification?: VehicleFinanceDocumentClassification | null;
  driverLicenceIntelligence?: VehicleFinanceDriverLicenceIntelligence | null;
  identityIntelligence?: VehicleFinanceIdentityDocumentIntelligence | null;
  payslipIntelligence?: VehicleFinancePayslipIntelligence | null;
  bankStatementIntelligence?: VehicleFinanceBankStatementIntelligence | null;
};

export type VehicleFinanceDocument = {
  documentId: string;
  applicationId: string;
  documentType: VehicleFinanceDocumentType;
  filePath: string;
  fileName: string;
  extractedText: string;
  aiAnalysis: VehicleFinanceDocumentAnalysis | Record<string, unknown>;
  uploadedAt: string;
  directTextLength: number;
  ocrTextLength: number;
  extractedTextLength: number;
  pageCount: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY";
};

export type VehicleFinanceTextQualityAssessment = {
  textLength: number;
  corruptedCharacterCount: number;
  corruptedCharacterRatio: number;
  confidence: number;
  confidenceThreshold: number;
  usable: boolean;
  shouldRunOcrFallback: boolean;
  flags: string[];
  reasons: string[];
};

export type VehicleFinanceDocumentClassification = {
  documentType: "DRIVER_LICENCE" | "GREEN_ID_BOOK" | "SMART_ID_CARD" | "SA_ID" | "PAYSLIP" | "BANK_STATEMENT" | "UNKNOWN" | "UNKNOWN_IDENTITY_DOCUMENT";
  confidence: number;
  reasons: string[];
};

export type VehicleFinanceDriverLicenceExtraction = {
  name: string | null;
  surname: string | null;
  idNumber: string | null;
  licenceNumber: string | null;
  dateOfBirth: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceCode: string | null;
  gender?: string | null;
  restriction?: string | null;
  country?: string | null;
  confidence: number;
  fieldConfidence?: Partial<Record<"name" | "surname" | "idNumber" | "licenceNumber" | "dateOfBirth" | "issueDate" | "expiryDate" | "licenceCode" | "gender" | "restriction" | "country", number>>;
  fields?: VehicleFinanceDriverLicenceStructuredExtraction;
};

export type VehicleFinanceDriverLicenceVerification = {
  passed: boolean;
  score: number;
  flags: string[];
};

export type VehicleFinanceDriverLicenceComparison = {
  flags: string[];
  passed: boolean;
};

export type VehicleFinanceCrossDocumentVerificationFlag =
  | "ID_MATCH"
  | "DOB_MATCH"
  | "GENDER_MATCH"
  | "SURNAME_MATCH"
  | "FORENAME_MATCH";

export type VehicleFinanceCrossDocumentVerification = {
  sourceDocumentType: "DRIVER_LICENCE";
  comparedDocumentType: "GREEN_ID_BOOK" | "SMART_ID_CARD";
  flags: VehicleFinanceCrossDocumentVerificationFlag[];
  fraudFlags: string[];
  passed: boolean;
  identityVerificationScore: number;
  riskLevel: VehicleFinanceRiskLevel;
};

export type VehicleFinanceDriverLicenceIntelligence = {
  enabled: boolean;
  featureFlag: boolean;
  textQuality: VehicleFinanceTextQualityAssessment;
  classification: VehicleFinanceDocumentClassification;
  extraction: VehicleFinanceDriverLicenceExtraction;
  verification: VehicleFinanceDriverLicenceVerification;
  applicationComparison: VehicleFinanceDriverLicenceComparison | null;
  crossDocumentVerification?: VehicleFinanceCrossDocumentVerification | null;
  usedOcrFallback: boolean;
  sourceTextLength: number;
  enhancedTextLength: number;
  selectedText: string;
};

export type VehicleFinanceDriverLicenceField = {
  value: string | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinanceDriverLicenceStructuredExtraction = {
  name: VehicleFinanceDriverLicenceField;
  surname: VehicleFinanceDriverLicenceField;
  idNumber: VehicleFinanceDriverLicenceField;
  licenceNumber: VehicleFinanceDriverLicenceField;
  dateOfBirth: VehicleFinanceDriverLicenceField;
  issueDate: VehicleFinanceDriverLicenceField;
  expiryDate: VehicleFinanceDriverLicenceField;
  licenceCode: VehicleFinanceDriverLicenceField;
  gender: VehicleFinanceDriverLicenceField;
  restriction: VehicleFinanceDriverLicenceField;
  country: VehicleFinanceDriverLicenceField;
};

export type VehicleFinanceIdentityField = {
  value: string | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinanceIdentityStructuredExtraction = {
  idNumber: VehicleFinanceIdentityField;
  surname: VehicleFinanceIdentityField;
  forenames: VehicleFinanceIdentityField;
  dateOfBirth: VehicleFinanceIdentityField;
  countryOfBirth: VehicleFinanceIdentityField;
  citizenship: VehicleFinanceIdentityField;
  dateIssued: VehicleFinanceIdentityField;
  issueNumber: VehicleFinanceIdentityField;
  gender: VehicleFinanceIdentityField;
};

export type VehicleFinanceIdentityIntegrityIndicators = {
  photoDetected: boolean;
  barcodeDetected: boolean;
  cardNumberDetected: boolean;
};

export type VehicleFinanceIdentityVerificationFlag =
  | "MISSING_ID_NUMBER"
  | "MISSING_SURNAME"
  | "MISSING_FORENAMES"
  | "MISSING_DATE_OF_BIRTH";

export type VehicleFinanceIdentityVerification = {
  passed: boolean;
  score: number;
  flags: VehicleFinanceIdentityVerificationFlag[];
};

export type VehicleFinanceIdentityDocumentIntelligence = {
  documentType: "GREEN_ID_BOOK" | "SMART_ID_CARD" | "UNKNOWN_IDENTITY_DOCUMENT";
  enabled: boolean;
  featureFlag: boolean;
  classification: VehicleFinanceDocumentClassification;
  extraction: VehicleFinanceIdentityStructuredExtraction;
  verification: VehicleFinanceIdentityVerification;
  integrityIndicators: VehicleFinanceIdentityIntegrityIndicators;
  overallConfidence: number;
  sourceText: string;
  sourceTextLength: number;
  selectedText: string;
  crossDocumentVerification?: VehicleFinanceCrossDocumentVerification | null;
  fields?: VehicleFinanceIdentityStructuredExtraction;
};

export type VehicleFinancePayslipField = {
  value: string | number | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinancePayslipLineItem = {
  type: string;
  amount: number | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinancePayslipStructuredExtraction = {
  employerName: VehicleFinancePayslipField;
  employeeName: VehicleFinancePayslipField;
  employeeNumber: VehicleFinancePayslipField;
  designation: VehicleFinancePayslipField;
  grossEarnings: VehicleFinancePayslipField;
  totalDeductions: VehicleFinancePayslipField;
  netPay: VehicleFinancePayslipField;
  payDate: VehicleFinancePayslipField;
  payPeriod: VehicleFinancePayslipField;
  benefits: VehicleFinancePayslipLineItem[];
  deductions: VehicleFinancePayslipLineItem[];
};

export type VehicleFinancePayslipVerificationFlag =
  | "MISSING_EMPLOYER"
  | "MISSING_EMPLOYEE_NAME"
  | "MISSING_GROSS_EARNINGS"
  | "MISSING_NET_PAY"
  | "MISSING_PAY_DATE";

export type VehicleFinancePayslipVerification = {
  passed: boolean;
  verificationScore: number;
  flags: VehicleFinancePayslipVerificationFlag[];
};

export type VehicleFinancePayslipCrossDocumentPreparation = {
  employeeName: VehicleFinancePayslipField;
  surname: VehicleFinancePayslipField;
};

export type VehicleFinancePayslipIntelligence = {
  enabled: boolean;
  featureFlag: boolean;
  documentType: "PAYSLIP";
  classification: VehicleFinanceDocumentClassification;
  extraction: VehicleFinancePayslipStructuredExtraction;
  verification: VehicleFinancePayslipVerification;
  overallConfidence: number;
  sourceText: string;
  sourceTextLength: number;
  selectedText: string;
  crossDocumentPreparation?: VehicleFinancePayslipCrossDocumentPreparation | null;
  fields?: VehicleFinancePayslipStructuredExtraction;
};

export type VehicleFinanceBankField = {
  value: string | number | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinanceBankFingerprint = {
  bankName: VehicleFinanceBankName;
  documentVersion: string | null;
  statementLayout: string | null;
  confidence: number;
  sourceText: string;
  reasons: string[];
};

export type VehicleFinanceBankTransaction = {
  date: string | null;
  description: string;
  category: string;
  amount: number | null;
  direction: "CREDIT" | "DEBIT" | "UNKNOWN";
  runningBalance: number | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinanceBankSalaryIntelligence = {
  averageSalary: VehicleFinanceBankField;
  salaryFrequency: VehicleFinanceBankField;
  salaryConsistency: VehicleFinanceBankField;
  latestSalary: VehicleFinanceBankField;
  salaryTrend: VehicleFinanceBankField;
  salaryDeposits: VehicleFinanceBankLineItem[];
  flags: string[];
};

export type VehicleFinanceBankCommitmentSummary = {
  monthlyDebtCommitments: VehicleFinanceBankField;
  monthlyInsuranceCommitments: VehicleFinanceBankField;
  monthlyTelecomCommitments: VehicleFinanceBankField;
  totalMonthlyCommitments: VehicleFinanceBankField;
  recurringCommitments: VehicleFinanceBankLineItem[];
};

export type VehicleFinanceBankGamblingRisk = {
  gamblingSpend: VehicleFinanceBankField;
  gamblingFrequency: VehicleFinanceBankField;
  gamblingPercentageOfIncome: VehicleFinanceBankField;
  riskLevel: VehicleFinanceRiskLevel;
  flags: string[];
};

export type VehicleFinanceBankAffordability = {
  grossIncome: VehicleFinanceBankField;
  netIncome: VehicleFinanceBankField;
  monthlyCommitments: VehicleFinanceBankField;
  disposableIncome: VehicleFinanceBankField;
  affordabilityScore: VehicleFinanceBankField;
  maxAffordableInstalment: VehicleFinanceBankField;
  starterVehicle: VehicleFinanceBankField;
  midRangeVehicle: VehicleFinanceBankField;
  premiumVehicle: VehicleFinanceBankField;
};

export type VehicleFinanceBankLineItem = {
  type: string;
  amount: number | null;
  date?: string | null;
  confidence: number;
  sourceText: string;
};

export type VehicleFinanceBankStatementStructuredExtraction = {
  confidence?: number;
  bankName: VehicleFinanceBankField;
  bankFingerprint?: VehicleFinanceBankFingerprint | null;
  documentVersion?: VehicleFinanceBankField;
  statementLayout?: VehicleFinanceBankField;
  accountHolder: VehicleFinanceBankField;
  accountNumber: VehicleFinanceBankField;
  statementPeriod: VehicleFinanceBankField;
  openingBalance: VehicleFinanceBankField;
  closingBalance: VehicleFinanceBankField;
  averageMonthlyIncome: VehicleFinanceBankField;
  disposableIncomeEstimate: VehicleFinanceBankField;
  monthlyDebtCommitments?: VehicleFinanceBankField;
  monthlyInsuranceCommitments?: VehicleFinanceBankField;
  monthlyTelecomCommitments?: VehicleFinanceBankField;
  salaryDeposits: VehicleFinanceBankLineItem[];
  recurringCommitments: VehicleFinanceBankLineItem[];
  gamblingTransactions: VehicleFinanceBankLineItem[];
  transactions?: VehicleFinanceBankTransaction[];
  salaryIntelligence?: VehicleFinanceBankSalaryIntelligence | null;
  commitmentSummary?: VehicleFinanceBankCommitmentSummary | null;
  gamblingRisk?: VehicleFinanceBankGamblingRisk | null;
  affordability?: VehicleFinanceBankAffordability | null;
  crossDocumentPreparation?: VehicleFinanceBankStatementCrossDocumentPreparation | null;
};

export type VehicleFinanceBankStatementVerificationFlag =
  | "MISSING_ACCOUNT_HOLDER"
  | "MISSING_ACCOUNT_NUMBER"
  | "NO_SALARY_DEPOSITS"
  | "HIGH_GAMBLING_ACTIVITY"
  | "HIGH_RECURRING_DEBT"
  | "MISSING_STATEMENT_PERIOD";

export type VehicleFinanceBankStatementVerification = {
  verificationScore: number;
  passed: boolean;
  flags: VehicleFinanceBankStatementVerificationFlag[];
};

export type VehicleFinanceBankStatementCrossDocumentPreparation = {
  employeeName: VehicleFinanceBankField;
  employerName: VehicleFinanceBankField;
  netPay: VehicleFinanceBankField;
  salaryDeposits: VehicleFinanceBankLineItem[];
};

export type VehicleFinanceBankStatementIntelligence = {
  enabled: boolean;
  featureFlag: boolean;
  documentType: "BANK_STATEMENT";
  bankFingerprint?: VehicleFinanceBankFingerprint | null;
  classification: VehicleFinanceDocumentClassification;
  extraction: VehicleFinanceBankStatementStructuredExtraction;
  verification: VehicleFinanceBankStatementVerification;
  overallConfidence: number;
  sourceText: string;
  sourceTextLength: number;
  selectedText: string;
  crossDocumentPreparation?: VehicleFinanceBankStatementCrossDocumentPreparation | null;
  fields?: VehicleFinanceBankStatementStructuredExtraction;
};

export const VEHICLE_FINANCE_IDENTITY_INTELLIGENCE_JOB_COLLECTION =
  "vehicleFinanceIdentityIntelligenceJobs";

export type VehicleFinanceIdentityIntelligenceJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type VehicleFinanceIdentityIntelligenceJob = {
  jobId: string;
  applicationId: string;
  documentId: string;
  status: VehicleFinanceIdentityIntelligenceJobStatus;
  createdAt: string;
  updatedAt: string;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];



  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultDocumentId?: string | null;
};

export const VEHICLE_FINANCE_PAYSLIP_INTELLIGENCE_JOB_COLLECTION =
  "vehicleFinancePayslipIntelligenceJobs";

export type VehicleFinancePayslipIntelligenceJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type VehicleFinancePayslipIntelligenceJob = {
  jobId: string;
  applicationId: string;
  documentId: string;
  status: VehicleFinancePayslipIntelligenceJobStatus;
  createdAt: string;
  updatedAt: string;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];



  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultDocumentId?: string | null;
};

export const VEHICLE_FINANCE_BANK_STATEMENT_INTELLIGENCE_JOB_COLLECTION =
  "vehicleFinanceBankStatementIntelligenceJobs";

export type VehicleFinanceBankStatementIntelligenceJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type VehicleFinanceBankStatementIntelligenceJob = {
  jobId: string;
  applicationId: string;
  documentId: string;
  status: VehicleFinanceBankStatementIntelligenceJobStatus;
  createdAt: string;
  updatedAt: string;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];



  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultDocumentId?: string | null;
};

export const VEHICLE_FINANCE_DRIVER_LICENCE_INTELLIGENCE_JOB_COLLECTION =
  "vehicleFinanceDriverLicenceIntelligenceJobs";

export type VehicleFinanceDriverLicenceIntelligenceJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type VehicleFinanceDriverLicenceIntelligenceJob = {
  jobId: string;
  applicationId: string;
  documentId: string;
  status: VehicleFinanceDriverLicenceIntelligenceJobStatus;
  createdAt: string;
  updatedAt: string;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];



  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultDocumentId?: string | null;
};

export type VehicleFinanceAssessment = {
  applicationId: string;
  identityScore: number;
  incomeScore: number;
  bankScore: number;
  documentIntegrityScore: number;
  overallFraudScore: number;
  riskLevel: VehicleFinanceRiskLevel;
  verificationStatus: "PENDING" | "REVIEW" | "VERIFIED" | "FLAGGED";
  riskReasons: string[];
  updatedAt: string;
  workflowSnapshot?: any;
  workflowStageId?: string;
  workflowStageLabel?: string;
  workflowProgressPercentage?: number;
  workflowNextRequiredAction?: string;
  workflowTaskCount?: number;
  workflowOverdueTaskCount?: number;
  workflowTimelineEventCount?: number;
  aiRiskScore?: number;
  aiAffordabilityAssessment?: string;
  aiDocumentCompleteness?: number;
  aiMissingInformation?: string[];
  aiRecommendedNextAction?: string;
  aiSuggestedBanks?: string[];



};

export type VehicleFinanceCertificate = {
  certificateId: string;
  applicationId: string;
  certificateUrl: string;
  certificatePath: string;
  verificationDate: string;
  verifiedBy: string;
  createdAt: string;
};

export const VEHICLE_FINANCE_DOCUMENT_LABELS: Record<VehicleFinanceDocumentType, string> = {
  saIdDocument: "South African ID Document",
  greenIdBook: "Green Barcoded ID Book",
  smartIdCard: "Smart ID Card",
  driversLicense: "Driver's License",
  payslip: "Payslip",
  bankStatement: "Bank Statement",
  proofOfAddress: "Proof of Address",
  employmentLetter: "Employment Letter",
};

export function normalizeVehicleFinanceDocumentType(value: unknown): VehicleFinanceDocumentType | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "") : "";

  switch (normalized) {
    case "saidocument":
    case "iddocument":
    case "southafricaniddocument":
    case "id":
      return "saIdDocument";
    case "greenidbook":
    case "greenbook":
      return "greenIdBook";
    case "smartidcard":
    case "smartid":
      return "smartIdCard";
    case "driverslicense":
    case "licence":
    case "drivinglicense":
      return "driversLicense";
    case "payslip":
    case "salaryslip":
      return "payslip";
    case "bankstatement":
    case "statement":
      return "bankStatement";
    case "proofofaddress":
    case "addressproof":
      return "proofOfAddress";
    case "employmentletter":
    case "offerletter":
      return "employmentLetter";
    default:
      return null;
  }
}

export function getVehicleFinanceDocumentLabel(type: VehicleFinanceDocumentType): string {
  return VEHICLE_FINANCE_DOCUMENT_LABELS[type];
}

export function resolveVehicleFinanceRiskLevel(score: number): VehicleFinanceRiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

export const VEHICLE_FINANCE_BUSINESS_CLIENT_STATUSES = ["ACTIVE", "ON_HOLD", "SUSPENDED", "ARCHIVED"] as const; export type VehicleFinanceBusinessClientStatus = (typeof VEHICLE_FINANCE_BUSINESS_CLIENT_STATUSES)[number];
export const VEHICLE_FINANCE_SUPPLIER_RELATIONSHIP_STATUSES = ["PROSPECT", "CONFIRMED", "PREFERRED", "ON_HOLD", "ARCHIVED"] as const; export type VehicleFinanceSupplierRelationshipStatus = (typeof VEHICLE_FINANCE_SUPPLIER_RELATIONSHIP_STATUSES)[number]; export const VEHICLE_FINANCE_SUPPLIER_CATEGORIES = ["DEALER", "OEM", "BROKER", "FLEET_PARTNER", "OTHER"] as const; export type VehicleFinanceSupplierCategory = (typeof VEHICLE_FINANCE_SUPPLIER_CATEGORIES)[number];
export const VEHICLE_FINANCE_SUPPLIER_CLASSIFICATIONS = ["FRANCHISE", "INDEPENDENT", "OTHER"] as const; export type VehicleFinanceSupplierClassification = (typeof VEHICLE_FINANCE_SUPPLIER_CLASSIFICATIONS)[number];
export const VEHICLE_FINANCE_PROCUREMENT_CASE_STATUSES = ["DRAFT", "REQUIREMENT_CONFIRMED", "SOURCING", "QUOTES_RECEIVED", "CLIENT_REVIEW", "CLIENT_APPROVED", "ORDER_CONFIRMED", "VEHICLE_ORDERED", "DELIVERY_PENDING", "DELIVERED", "COMPLETED", "CANCELLED", "ON_HOLD"] as const; export type VehicleFinanceProcurementCaseStatus = (typeof VEHICLE_FINANCE_PROCUREMENT_CASE_STATUSES)[number];
export const VEHICLE_FINANCE_PROCUREMENT_PURCHASE_METHODS = ["CASH", "FINANCE", "LEASE", "PURCHASE_ORDER", "OTHER"] as const; export type VehicleFinanceProcurementPurchaseMethod = (typeof VEHICLE_FINANCE_PROCUREMENT_PURCHASE_METHODS)[number]; export const VEHICLE_FINANCE_PROCUREMENT_CONDITIONS = ["NEW", "DEMO", "USED"] as const; export type VehicleFinanceProcurementCondition = (typeof VEHICLE_FINANCE_PROCUREMENT_CONDITIONS)[number]; export const VEHICLE_FINANCE_SUPPLIER_QUOTE_STATES = ["SUBMITTED", "PREFERRED", "SELECTED", "DECLINED", "EXPIRED"] as const; export type VehicleFinanceSupplierQuoteState = (typeof VEHICLE_FINANCE_SUPPLIER_QUOTE_STATES)[number];
export const VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES = ["QUOTE_RECEIVED", "UNDER_REVIEW", "SUBMITTED_TO_CLIENT", "CLIENT_REVIEW", "REVISION_REQUESTED", "AWAITING_CLIENT_DECISION", "SELECTED", "ORDER_PENDING", "ORDER_CONFIRMED", "DELIVERY_PENDING", "DELIVERED", "COMPLETED", "NOT_SELECTED", "CANCELLED"] as const; export type VehicleFinancePartnerVisibleStatus = (typeof VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES)[number];
export type VehicleFinancePartnerMessageTemplate = { messageTemplateId: string; status: VehicleFinancePartnerVisibleStatus; message: string; reviewedCustomTextAllowed?: boolean };
export const VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES = [{ messageTemplateId: "quote_received_received", status: "QUOTE_RECEIVED", message: "Your quotation has been received by Torque Empire." }, { messageTemplateId: "quote_received_awaiting_review", status: "QUOTE_RECEIVED", message: "Your quotation has been received and is awaiting internal review." }, { messageTemplateId: "under_review_default", status: "UNDER_REVIEW", message: "Your quotation is currently under review." }, { messageTemplateId: "submitted_to_client_default", status: "SUBMITTED_TO_CLIENT", message: "Your quotation has been submitted for client consideration." }, { messageTemplateId: "client_review_default", status: "CLIENT_REVIEW", message: "The client is currently reviewing the submitted quotation." }, { messageTemplateId: "awaiting_client_decision_default", status: "AWAITING_CLIENT_DECISION", message: "The quotation remains under client consideration. No further action is required from you at this stage." }, { messageTemplateId: "revision_requested_default", status: "REVISION_REQUESTED", message: "A quotation revision is required. Please review the requested changes.", reviewedCustomTextAllowed: true }, { messageTemplateId: "selected_default", status: "SELECTED", message: "Your quotation has been selected, subject to completion of the remaining procurement steps." }, { messageTemplateId: "order_pending_default", status: "ORDER_PENDING", message: "The transaction is progressing and order confirmation is pending." }, { messageTemplateId: "order_confirmed_default", status: "ORDER_CONFIRMED", message: "The order has been confirmed." }, { messageTemplateId: "delivery_pending_default", status: "DELIVERY_PENDING", message: "The transaction is awaiting vehicle/product delivery." }, { messageTemplateId: "delivered_default", status: "DELIVERED", message: "Delivery has been recorded." }, { messageTemplateId: "completed_default", status: "COMPLETED", message: "This procurement transaction has been completed." }, { messageTemplateId: "not_selected_default", status: "NOT_SELECTED", message: "The quotation was not selected for this procurement requirement." }, { messageTemplateId: "cancelled_default", status: "CANCELLED", message: "This procurement requirement has been cancelled." }] as readonly VehicleFinancePartnerMessageTemplate[];
export type VehicleFinanceSupplierQuoteDocument = { documentId: string; fileName: string; fileUrl?: string | null; storagePath?: string | null; mimeType?: string | null; sizeBytes?: number | null; uploadedAt: string; uploadedBy?: string | null; notes?: string | null };
export type VehicleFinancePartnerActivity = { status: VehicleFinancePartnerVisibleStatus; timestamp: string; actorId: string | null; actorName: string | null; note: string };
export type VehicleFinanceAuditMetadata = { createdAt: string; updatedAt: string; createdBy?: string | null; updatedBy?: string | null; operatingDivision?: string | null }; export type VehicleFinanceBusinessClient = VehicleFinanceAuditMetadata & { businessClientId: string; legalName: string; tradingName?: string | null; registrationNumber: string; vatNumber?: string | null; industry?: string | null; accountStatus: VehicleFinanceBusinessClientStatus; primaryContact: string; procurementContact?: string | null; phone: string; email: string; registeredAddress?: string | null; billingAddress?: string | null; accountManager?: string | null; preferredTransactionMethod?: string | null; procurementNotes?: string | null };
export type VehicleFinanceSupplier = VehicleFinanceAuditMetadata & { supplierId: string; legalName: string; tradingName?: string | null; supplierCategory: VehicleFinanceSupplierCategory; classification: VehicleFinanceSupplierClassification; brandsRepresented: string[]; branchLocation?: string | null; primarySalesContact: string; fleetContact?: string | null; email: string; phone: string; relationshipStatus: VehicleFinanceSupplierRelationshipStatus; preferredSupplier: boolean; quoteTurnaroundNotes?: string | null; geographicCoverage?: string | null; commercialNotes?: string | null; active: boolean; archived: boolean };
export type VehicleFinanceProcurementCase = VehicleFinanceAuditMetadata & { procurementCaseId: string; businessClientId: string; clientRequestor: string; internalReference: string; clientReferenceNumber?: string | null; accountOwner: string; vehicleQuantity: number; make: string; model: string; variant?: string | null; fuelType?: string | null; colour?: string | null; requiredSpecifications?: string | null; condition: VehicleFinanceProcurementCondition; purchaseMethod: VehicleFinanceProcurementPurchaseMethod; budget?: number | null; requiredDeliveryDate?: string | null; notes?: string | null; internalStatus: VehicleFinanceProcurementCaseStatus; partnerVisibleStatus: VehicleFinancePartnerVisibleStatus; lifecycleStatus: VehicleFinanceProcurementCaseStatus; partnerPublicationSequence?: number; activityHistory: Array<{ status: VehicleFinanceProcurementCaseStatus; timestamp: string; actorId: string | null; actorName: string | null; note: string }> };
export type VehicleFinanceSupplierQuote = VehicleFinanceAuditMetadata & { supplierQuoteId: string; supplierId: string; procurementCaseId: string; vehicleDescription: string; quotedAmount: number; availability: string; quoteDate: string; quoteExpiry?: string | null; supplierReference?: string | null; colourSpecification?: string | null; quoteState: VehicleFinanceSupplierQuoteState; notes?: string | null; internalNotes?: string | null; partnerVisibleStatus: VehicleFinancePartnerVisibleStatus; partnerVisibleStatusUpdatedAt?: string | null; partnerVisibleStatusUpdatedBy?: string | null; messageTemplateId?: string | null; renderedPartnerMessage?: string | null; publishedAt?: string | null; publishedBy?: string | null; partnerPublicationOrder?: number | null; stockAvailability?: string | null; expectedDeliveryDate?: string | null; colourSpecificationConfirmed?: boolean; partnerNotes?: string | null; revisionRequestOpen?: boolean; supportingDocuments: VehicleFinanceSupplierQuoteDocument[]; partnerActivityHistory: VehicleFinancePartnerActivity[] }; export type VehicleFinanceProcurementSummary = { activeBusinessClients: number; activeProcurementCases: number; registeredSuppliers: number; quotesAwaitingClientDecision: number; vehiclesPendingDelivery: number };
