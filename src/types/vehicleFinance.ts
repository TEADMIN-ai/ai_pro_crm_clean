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
};

export type VehicleFinanceApplication = {
  applicationId: string;
  customerId: string;
  vehicleId: string;
  dealerName: string;
  dealValue: number;
  applicationStatus: "NEW" | "IN_REVIEW" | "VERIFIED" | "FLAGGED" | "REJECTED";
  fraudScore: number;
  verificationStatus: "PENDING" | "REVIEW" | "VERIFIED" | "FLAGGED";
  createdAt: string;
  updatedAt: string;
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
