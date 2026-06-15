export const VEHICLE_FINANCE_TRAINING_CATEGORIES = [
  "ids",
  "drivers-licences",
  "payslips",
  "bank-statements",
  "proof-of-address",
  "employment-letters",
] as const;

export type VehicleFinanceTrainingCategory = (typeof VEHICLE_FINANCE_TRAINING_CATEGORIES)[number];

export const VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS: Record<VehicleFinanceTrainingCategory, string> = {
  ids: "South African ID",
  "drivers-licences": "Driver's License",
  payslips: "Payslip",
  "bank-statements": "Bank Statement",
  "proof-of-address": "Proof of Address",
  "employment-letters": "Employment Letter",
};

export const VEHICLE_FINANCE_TRAINING_STORAGE_ROOT = "vehicle-finance-training";

export const VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS: Record<VehicleFinanceTrainingCategory, string> = {
  ids: "ids",
  "drivers-licences": "drivers-licences",
  payslips: "payslips",
  "bank-statements": "bank-statements",
  "proof-of-address": "proof-of-address",
  "employment-letters": "employment-letters",
};

export const VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION = "vehicleFinanceTrainingDocuments";
export const VEHICLE_FINANCE_TRAINING_RESULT_COLLECTION = "vehicleFinanceTrainingResults";
export const VEHICLE_FINANCE_TRAINING_VALIDATION_JOB_COLLECTION = "vehicleFinanceTrainingValidationJobs";

export type VehicleFinanceTrainingDocumentStatus = "UPLOADED" | "VALIDATED" | "FAILED" | "NEEDS_REVIEW";

export type VehicleFinanceTrainingValidationJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type VehicleFinanceTrainingDocument = {
  documentId: string;
  category: VehicleFinanceTrainingCategory;
  filename: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: string;
  status: VehicleFinanceTrainingDocumentStatus;
};

export type VehicleFinanceTrainingExtractionMethod =
  | "PDF_TEXT"
  | "OPENAI_OCR"
  | "TESSERACT_OCR"
  | "COMBINED";

export type VehicleFinanceTrainingResult = {
  documentId: string;
  category: VehicleFinanceTrainingCategory;
  extractionMethod: VehicleFinanceTrainingExtractionMethod;
  extractedTextLength: number;
  extractedFields: Record<string, string>;
  confidenceScore: number;
  passedValidation: boolean;
  validationErrors: string[];
  createdAt: string;
  pdfTextLength?: number;
  openAiOcrTextLength?: number;
  tesseractOcrTextLength?: number;
  selectedTextPreview?: string;
  missingFields?: string[];
  expectedFields?: string[];
};

export type VehicleFinanceTrainingValidationJob = {
  jobId: string;
  documentId: string;
  status: VehicleFinanceTrainingValidationJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultDocumentId?: string | null;
};

export type VehicleFinanceTrainingFieldKind =
  | "text"
  | "name"
  | "identifier"
  | "date"
  | "money"
  | "number"
  | "period";

export type VehicleFinanceTrainingFieldDefinition = {
  key: string;
  label: string;
  kind: VehicleFinanceTrainingFieldKind;
  aliases?: string[];
  required?: boolean;
};

export type VehicleFinanceTrainingTemplate = {
  category: VehicleFinanceTrainingCategory;
  label: string;
  storageFolder: string;
  requiredFields: string[];
  fields: VehicleFinanceTrainingFieldDefinition[];
};

export type VehicleFinanceTrainingOverview = {
  metrics: {
    ocrSuccessRate: number;
    averageConfidence: number;
    extractionAccuracy: number;
    failedDocuments: number;
    failedExtractions: number;
    missingFields: number;
    totalDocuments: number;
    validatedDocuments: number;
  };
  documents: VehicleFinanceTrainingDocument[];
  results: VehicleFinanceTrainingResult[];
};
