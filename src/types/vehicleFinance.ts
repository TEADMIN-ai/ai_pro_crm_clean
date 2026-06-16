export const VEHICLE_FINANCE_DOCUMENT_TYPES = [
  "saIdDocument",
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
  documentType: "DRIVER_LICENCE" | "SA_ID" | "PAYSLIP" | "BANK_STATEMENT" | "UNKNOWN";
  confidence: number;
  reasons: string[];
};

export type VehicleFinanceDriverLicenceExtraction = {
  name: string | null;
  surname: string | null;
  idNumber: string | null;
  licenceNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceCode: string | null;
  confidence: number;
  fieldConfidence?: Partial<Record<"name" | "surname" | "idNumber" | "licenceNumber" | "issueDate" | "expiryDate" | "licenceCode", number>>;
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

export type VehicleFinanceDriverLicenceIntelligence = {
  enabled: boolean;
  featureFlag: boolean;
  textQuality: VehicleFinanceTextQualityAssessment;
  classification: VehicleFinanceDocumentClassification;
  extraction: VehicleFinanceDriverLicenceExtraction;
  verification: VehicleFinanceDriverLicenceVerification;
  applicationComparison: VehicleFinanceDriverLicenceComparison | null;
  usedOcrFallback: boolean;
  sourceTextLength: number;
  enhancedTextLength: number;
  selectedText: string;
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
