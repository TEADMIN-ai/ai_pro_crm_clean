export type QsRecordStatus = "active" | "inactive" | "archived";

export type QsCurrencyCode = "ZAR";

export type QsProvince =
  | "Eastern Cape"
  | "Free State"
  | "Gauteng"
  | "KwaZulu-Natal"
  | "Limpopo"
  | "Mpumalanga"
  | "Northern Cape"
  | "North West"
  | "Western Cape"
  | "National";

export type QsPriceSource = "manual" | "supplierCatalogue" | "import" | "futureLivePricing" | "quote";

export type QsTimestamp = string;

export type QsBoqDocumentType = "boq" | "rfq" | "scopeOfWork";

export type QsBoqFileType = "pdf" | "docx" | "xlsx" | "csv" | "txt";

export type QsBoqTrade =
  | "General"
  | "Earthworks"
  | "Concrete"
  | "Brickwork"
  | "Steel"
  | "Roofing"
  | "Doors"
  | "Windows"
  | "Electrical"
  | "Lighting"
  | "Plumbing"
  | "Sanitary"
  | "Painting"
  | "Flooring"
  | "Ceilings"
  | "Drywall"
  | "External Works"
  | "Civil"
  | "Landscaping"
  | "Other";

export type QsBoqConfidence = "High" | "Medium" | "Low";

export type QsBoqReviewStatus = "pending" | "accepted" | "edited" | "rejected" | "rematchRequired";

export type QsBoqExtractionSource = "directText" | "ocr" | "spreadsheet" | "text" | "docx" | "empty";

export type QsAiExtractionMetadata = {
  sourceText?: string | null;
  sourceDocumentId?: string | null;
  normalizedName?: string | null;
  aliases?: string[];
  confidence?: number | null;
  lastMatchedAt?: QsTimestamp | null;
};

export type QsLearningMetadata = {
  previousQuoteIds?: string[];
  historicalCostIds?: string[];
  supplierPerformanceIds?: string[];
  projectSimilarityKeys?: string[];
  inflationBaselinePriceHistoryId?: string | null;
};

export type QsAuditFields = {
  createdAt: QsTimestamp;
  updatedAt: QsTimestamp;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UnitOfMeasure = QsAuditFields & {
  unitId: string;
  label: string;
  symbol: string;
  aliases: string[];
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type ProvincePricing = {
  province: QsProvince;
  price: number;
  currency: QsCurrencyCode;
  supplierId?: string | null;
  effectiveDate?: QsTimestamp | null;
};

export type MaterialCategory = QsAuditFields & {
  categoryId: string;
  name: string;
  parentCategoryId?: string | null;
  description?: string | null;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type Brand = QsAuditFields & {
  brandId: string;
  name: string;
  manufacturer?: string | null;
  website?: string | null;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type SupplierContactDetails = {
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type Supplier = QsAuditFields & {
  supplierId: string;
  name: string;
  website?: string | null;
  contactDetails: SupplierContactDetails;
  provinceCoverage: QsProvince[];
  deliveryAvailable: boolean;
  preferredSupplier: boolean;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
  learning?: QsLearningMetadata;
};

export type Material = QsAuditFields & {
  materialId: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  normalizedName?: string | null;
  description?: string | null;
  categoryId: string;
  subcategory?: string | null;
  brandId?: string | null;
  unit: string;
  vatApplicable: boolean;
  defaultSupplier?: string | null;
  averageMarketPrice?: number | null;
  preferredSupplier?: string | null;
  currentPrice?: number | null;
  status: QsRecordStatus;
  tags?: string[];
  searchKeywords?: string[];
  supplierIds?: string[];
  provincePricing?: ProvincePricing[];
  aiExtraction?: QsAiExtractionMetadata;
  learning?: QsLearningMetadata;
};

export type MaterialPrice = QsAuditFields & {
  materialPriceId: string;
  materialId: string;
  supplierId?: string | null;
  province: QsProvince;
  price: number;
  currency: QsCurrencyCode;
  unit: string;
  vatInclusive: boolean;
  effectiveDate: QsTimestamp;
  source: QsPriceSource;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type SupplierPrice = QsAuditFields & {
  supplierPriceId: string;
  supplierId: string;
  materialId: string;
  sku?: string | null;
  supplierSku?: string | null;
  province: QsProvince;
  price: number;
  currency: QsCurrencyCode;
  unit: string;
  availabilityId?: string | null;
  catalogueImportId?: string | null;
  effectiveDate: QsTimestamp;
  source: QsPriceSource;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type PriceHistory = QsAuditFields & {
  priceHistoryId: string;
  materialId: string;
  supplierId?: string | null;
  province: QsProvince;
  price: number;
  currency: QsCurrencyCode;
  effectiveDate: QsTimestamp;
  capturedDate: QsTimestamp;
  source: QsPriceSource;
  createdBy?: string | null;
  quoteId?: string | null;
  projectId?: string | null;
  aiExtraction?: QsAiExtractionMetadata;
  learning?: QsLearningMetadata;
};

export type MaterialAvailability = QsAuditFields & {
  availabilityId: string;
  materialId: string;
  supplierId: string;
  province: QsProvince;
  available: boolean;
  quantityAvailable?: number | null;
  leadTimeDays?: number | null;
  deliveryAvailable: boolean;
  capturedDate: QsTimestamp;
  status: QsRecordStatus;
  aiExtraction?: QsAiExtractionMetadata;
};

export type QsBoqMaterialMatch = {
  materialId?: string | null;
  materialName?: string | null;
  matchConfidence: QsBoqConfidence;
  suggestedMaterialIds: string[];
  unknownMaterial: boolean;
};

export type QsBoqDocument = QsAuditFields & {
  boqDocumentId: string;
  projectId?: string | null;
  projectName?: string | null;
  documentType: QsBoqDocumentType;
  fileName: string;
  fileType: QsBoqFileType;
  mimeType?: string | null;
  storagePath?: string | null;
  uploadedBy?: string | null;
  uploadedByRole?: string | null;
  extractionSource: QsBoqExtractionSource;
  ocrUsed: boolean;
  parserUsed: string;
  originalTextPreview?: string | null;
  textLength: number;
  itemCount: number;
  reviewStatus: QsBoqReviewStatus;
  confidenceDistribution: Record<QsBoqConfidence, number>;
  extractionTimeMs: number;
};

export type QsBoqLineItem = QsAuditFields & {
  boqLineItemId: string;
  boqDocumentId: string;
  lineNumber: number;
  section?: string | null;
  trade: QsBoqTrade;
  originalText: string;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  normalizedUnit?: string | null;
  materialMatch: QsBoqMaterialMatch;
  confidenceScore: QsBoqConfidence;
  status: QsBoqReviewStatus;
  notes?: string | null;
};

export type QsBoqTradeRecord = QsAuditFields & {
  boqTradeId: string;
  name: QsBoqTrade;
  keywords: string[];
  status: QsRecordStatus;
};

export type QsBoqExtractionLog = QsAuditFields & {
  boqExtractionLogId: string;
  boqDocumentId: string;
  uploadedBy?: string | null;
  extractionTimeMs: number;
  ocrUsed: boolean;
  parserUsed: string;
  itemsExtracted: number;
  confidenceDistribution: Record<QsBoqConfidence, number>;
  reviewStatus: QsBoqReviewStatus;
  message: string;
};

export type QsBoqReviewQueueItem = QsAuditFields & {
  boqReviewQueueId: string;
  boqDocumentId: string;
  boqLineItemId: string;
  reason: string;
  originalText: string;
  suggestedAction: "accept" | "edit" | "reject" | "rematch";
  status: QsBoqReviewStatus;
};

export type QsFirestoreCollection =
  | "materials"
  | "materialCategories"
  | "materialPrices"
  | "suppliers"
  | "supplierPrices"
  | "priceHistory"
  | "unitMeasurements"
  | "brands"
  | "materialAvailability"
  | "materialImports"
  | "importLogs"
  | "failedImports"
  | "importProfiles"
  | "boqDocuments"
  | "boqLineItems"
  | "boqTrades"
  | "boqExtractionLogs"
  | "boqReviewQueue";

export type QsImportFileType = "csv" | "xlsx" | "json";

export type QsDuplicateStrategy = "skip" | "update" | "replace" | "merge";

export type QsImportStatus = "pending" | "processing" | "completed" | "completedWithFailures" | "failed";

export type QsImportSourceType =
  | "materialCatalogue"
  | "supplierCatalogue"
  | "manufacturerCatalogue"
  | "internalPriceList";

export type QsImportColumnMappings = {
  materialName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  unit?: string | null;
  price?: string | null;
  currency?: string | null;
  supplier?: string | null;
  vatApplicable?: string | null;
  province?: string | null;
};

export type QsImportProfile = QsAuditFields & {
  importProfileId: string;
  profileName: string;
  sourceType: QsImportSourceType;
  supplierId?: string | null;
  fileType: QsImportFileType;
  columnMappings: QsImportColumnMappings;
  categoryMappings: Record<string, string>;
  supplierMappings: Record<string, string>;
  unitMappings: Record<string, string>;
  duplicateStrategy: QsDuplicateStrategy;
  status: QsRecordStatus;
};

export type QsMaterialImport = QsAuditFields & {
  materialImportId: string;
  importProfileId?: string | null;
  fileName: string;
  fileType: QsImportFileType;
  sourceType: QsImportSourceType;
  status: QsImportStatus;
  importedBy?: string | null;
  startedAt?: QsTimestamp | null;
  completedAt?: QsTimestamp | null;
  totalRows: number;
  rowsImported: number;
  rowsFailed: number;
  duplicateCount: number;
  updatedMaterials: number;
  newMaterials: number;
  executionTimeMs?: number | null;
  summary?: string | null;
};

export type QsImportLog = QsAuditFields & {
  importLogId: string;
  materialImportId: string;
  message: string;
  level: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
};

export type QsFailedImport = QsAuditFields & {
  failedImportId: string;
  materialImportId: string;
  rowNumber: number;
  rawRow: Record<string, string | number | boolean | null>;
  reasons: string[];
  suggestedCorrection?: string | null;
};

export type QsImportValidationIssue = {
  code:
    | "missing_material_name"
    | "missing_unit"
    | "negative_price"
    | "duplicate_sku"
    | "duplicate_barcode"
    | "invalid_category"
    | "unknown_supplier"
    | "invalid_vat"
    | "invalid_currency";
  field?: string;
  message: string;
  suggestedCorrection?: string | null;
};

export type QsParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
};

export type QsMappedMaterialImportRow = {
  rowNumber: number;
  materialName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  subcategory?: string | null;
  brandName?: string | null;
  brandId?: string | null;
  unit?: string | null;
  normalizedUnit?: string | null;
  price?: number | null;
  currency?: QsCurrencyCode | string | null;
  supplierName?: string | null;
  supplierId?: string | null;
  province?: QsProvince | string | null;
  vatApplicable?: boolean | null;
  raw: Record<string, string>;
};

export type QsCreateInput<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt?: QsTimestamp;
  updatedAt?: QsTimestamp;
};

export type QsUpdateInput<T> = Partial<Omit<T, "createdAt" | "updatedAt">> & {
  updatedBy?: string | null;
};
