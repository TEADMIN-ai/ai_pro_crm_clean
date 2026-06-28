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

export type QSQuoteReadinessStatus = "quoteReady" | "reviewRequired" | "pricingIncomplete" | "blocked";

export type QSAllowanceMode = "percentage" | "fixed";

export type QSLabourRateConfig = {
  ratePerHour: number;
  hoursPerUnit: number;
};

export type QSAllowanceConfig = {
  vatRate: number;
  vatEnabled: boolean;
  overheadPercentage: number;
  waste: {
    mode: QSAllowanceMode;
    value: number;
  };
  transport: {
    mode: QSAllowanceMode;
    value: number;
  };
  plant: {
    mode: QSAllowanceMode;
    value: number;
  };
  labourRates: Partial<Record<QsBoqTrade, QSLabourRateConfig>>;
};

export type QSProfitConfig = {
  profitPercentage: number;
};

export type QSRiskConfig = {
  riskPercentage: number;
  lowConfidenceRiskPercentage: number;
  missingPricingRiskPercentage: number;
};

export type QSCostBreakdown = {
  materialCost: number;
  labourCost: number;
  plantAllowance: number;
  transportAllowance: number;
  wasteAllowance: number;
  overhead: number;
  profit: number;
  riskAllowance: number;
  subtotalExVat: number;
  vatAmount: number;
  totalInclVat: number;
};

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

export type QSSupplierStatus = "active" | "inactive" | "pendingReview" | "archived";

export type QSSupplierSubscriptionTier = "none" | "starter" | "growth" | "premium" | "enterprise";

export type QSSupplierStockStatus = "inStock" | "limited" | "backOrder" | "outOfStock" | "unknown";

export type QSSupplierRecommendationCategory =
  | "BEST_PRICE"
  | "BEST_QUALITY"
  | "BEST_OVERALL_VALUE"
  | "FASTEST_DELIVERY"
  | "LOWEST_RISK";

export type QSSupplierRiskLevel = "low" | "medium" | "high";

export type QSSupplierDecisionStatus = "preferred" | "watchlist" | "blocked" | "neutral";

export type QSSupplierDecisionFlagReason =
  | "commercial_performance"
  | "delivery_performance"
  | "quality_concerns"
  | "pricing_accuracy"
  | "stock_reliability"
  | "management_decision"
  | "other";

export type QSTrendDirection = "improving" | "stable" | "declining" | "insufficientData";

export type QSSupplierContactActionType =
  | "CALL_SUPPLIER"
  | "EMAIL_SUPPLIER"
  | "REQUEST_QUOTE"
  | "REQUEST_DELIVERY_COST"
  | "SAVE_SUPPLIER"
  | "COMPARE_SUPPLIER";

export type QSSupplierContactStatus = "logged" | "pending" | "contacted" | "responded" | "closed";

export type QSSupplierBranch = {
  branchId: string;
  branchName: string;
  address?: string | null;
  province: QsProvince;
  city?: string | null;
  gps?: {
    latitude: number;
    longitude: number;
  } | null;
  contactNumber?: string | null;
  email?: string | null;
  deliveryRadiusKm?: number | null;
  standardDeliveryFee?: number | null;
  averageLeadTimeDays?: number | null;
};

export type QSSupplierPerformanceScore = {
  qualityScore: number;
  reliabilityScore: number;
  deliveryScore: number;
  priceCompetitivenessScore: number;
  stockAvailabilityScore: number;
  overallSupplierScore: number;
};

export type QSSupplierProfile = QsAuditFields & QSSupplierPerformanceScore & {
  supplierId: string;
  supplierName: string;
  tradingName?: string | null;
  companyRegistrationNumber?: string | null;
  vatNumber?: string | null;
  bbbeeLevel?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  branches: QSSupplierBranch[];
  deliveryAreas: QsProvince[];
  productCategories: string[];
  paymentTerms?: string | null;
  warrantyNotes?: string | null;
  isPreferredSupplier: boolean;
  isSponsoredSupplier: boolean;
  supplierSubscriptionTier: QSSupplierSubscriptionTier;
  leadFeeEnabled: boolean;
  leadFeeAmount?: number | null;
  referralCommissionEnabled: boolean;
  referralCommissionPercentage?: number | null;
  featuredPlacementEnabled: boolean;
  status: QSSupplierStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSSupplierProductOffer = QsAuditFields & {
  offerId: string;
  supplierId: string;
  materialId: string;
  materialName: string;
  category?: string | null;
  unit: string;
  unitPriceExVat: number;
  vatRate: number;
  stockStatus: QSSupplierStockStatus;
  availableQuantity?: number | null;
  leadTimeDays?: number | null;
  deliveryFee?: number | null;
  validFrom?: QsTimestamp | null;
  validUntil?: QsTimestamp | null;
  qualityGrade?: string | null;
  brand?: string | null;
  warranty?: string | null;
  notes?: string | null;
  pricingSource: QsPriceSource;
  status: QsRecordStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
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

export type QSEstimateLine = {
  estimateLineId: string;
  boqLineItemId: string;
  boqDocumentId: string;
  description: string;
  trade: QsBoqTrade;
  unit?: string | null;
  quantity: number;
  matchedMaterialIds: string[];
  materialUnitCost: number | null;
  materialTotal: number;
  labourRate: number;
  labourHours: number;
  labourTotal: number;
  plantEquipmentCost: number;
  transportAllowance: number;
  wasteAllowance: number;
  overheadAmount: number;
  profitAmount: number;
  riskAmount: number;
  lineSubtotal: number;
  vatAmount: number;
  lineTotal: number;
  confidenceScore: number;
  warnings: string[];
  pricingSource: QsPriceSource | "materialAverage" | "materialCurrent" | "none";
};

export type QSEstimate = QsAuditFields & {
  estimateId: string;
  sourceBoqId: string;
  projectId?: string | null;
  projectName?: string | null;
  status: QSQuoteReadinessStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
  assumptions: QSAllowanceConfig & QSProfitConfig & QSRiskConfig;
  lines: QSEstimateLine[];
  breakdown: QSCostBreakdown;
  totalEstimatedProjectValue: number;
  confidenceScore: number;
  missingPricingWarnings: string[];
  quoteReadinessStatus: QSQuoteReadinessStatus;
  sourceItemCount: number;
};

export type QSEstimateHistory = QsAuditFields & {
  estimateHistoryId: string;
  estimateId: string;
  sourceBoqId: string;
  version: number;
  snapshot: QSEstimate;
  createdByUid?: string | null;
  reason: "created" | "configUpdated" | "recalculated";
};

export type QSSupplierRecommendation = QsAuditFields & {
  recommendationId: string;
  estimateId: string;
  estimateLineId: string;
  boqLineItemId: string;
  materialId: string;
  category: QSSupplierRecommendationCategory;
  supplierId: string;
  supplierName: string;
  offerId: string;
  materialName: string;
  isSponsoredSupplier: boolean;
  unitPriceExVat: number;
  quantity: number;
  landedCostExVat: number;
  vatAmount: number;
  landedCostInclVat: number;
  score: number;
  priceScore: number;
  qualityScore: number;
  deliveryScore: number;
  stockAvailabilityScore: number;
  reliabilityScore: number;
  transportScore: number;
  costImpact: number;
  marginImpact: number;
  deliveryImpactDays: number;
  transportImpact: number;
  riskLevel: QSSupplierRiskLevel;
  explanation: string;
  tradeOffs: string[];
  confidenceScore: number;
  status: QsRecordStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSSupplierComparison = QsAuditFields & {
  comparisonId: string;
  estimateId: string;
  estimateLineId: string;
  materialId: string;
  recommendations: QSSupplierRecommendation[];
  bestPriceSupplierId?: string | null;
  bestQualitySupplierId?: string | null;
  bestOverallSupplierId?: string | null;
  fastestDeliverySupplierId?: string | null;
  lowestRiskSupplierId?: string | null;
  status: QsRecordStatus;
  version: number;
};

export type QSCommercialImpactScenario = QsAuditFields & {
  scenarioId: string;
  estimateId: string;
  estimateLineId: string;
  supplierId: string;
  supplierName: string;
  offerId: string;
  recommendationCategory: QSSupplierRecommendationCategory;
  currentEstimateTotal: number;
  newEstimateTotal: number;
  costSaving: number;
  costIncrease: number;
  profitImpact: number;
  marginImpactPercentage: number;
  transportImpact: number;
  deliveryImpactDays: number;
  riskImpact: QSSupplierRiskLevel;
  quoteReadinessImpact: QSQuoteReadinessStatus;
  explanation: string;
  status: QsRecordStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSSupplierPerformanceRating = QsAuditFields & {
  ratingId: string;
  supplierId: string;
  supplierName?: string | null;
  estimateId?: string | null;
  projectId?: string | null;
  deliveryReliabilityScore: number;
  priceAccuracyScore: number;
  qualityRating: number;
  stockAccuracyScore: number;
  communicationRating: number;
  returnsDefectsRate: number;
  invoiceAccuracyScore: number;
  overallSupplierScore: number;
  trendDirection: QSTrendDirection;
  lastEvaluatedAt: QsTimestamp;
  notes?: string | null;
  status: QsRecordStatus;
  version: number;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSRecommendationOutcome = "accepted" | "overridden" | "notUsed" | "pending";

export type QSCompletedProjectFeedback = QsAuditFields & {
  feedbackId: string;
  estimateId: string;
  projectId?: string | null;
  projectName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  recommendationId?: string | null;
  recommendationOutcome: QSRecommendationOutcome;
  overrideReason?: string | null;
  expectedMaterialCost: number;
  actualMaterialCost: number;
  expectedLabourCost: number;
  actualLabourCost: number;
  expectedTransportCost: number;
  actualTransportCost: number;
  deliveryPerformanceScore: number;
  defectsReturnsRate: number;
  finalProfitMarginPercentage: number;
  projectFeedbackScore?: number | null;
  projectFeedbackNotes?: string | null;
  completedAt: QsTimestamp;
  learningStatus: "captured" | "reviewed" | "readyForTrainingExport";
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSMaterialPriceObservation = QsAuditFields & {
  observationId: string;
  materialId: string;
  materialName: string;
  supplierId?: string | null;
  supplierName?: string | null;
  province?: QsProvince | null;
  city?: string | null;
  unit: string;
  price: number;
  currency: QsCurrencyCode;
  observedAt: QsTimestamp;
  source: QsPriceSource;
  status: QsRecordStatus;
  createdByUid?: string | null;
  updatedByUid?: string | null;
};

export type QSPriceMovementSignal = {
  materialId: string;
  materialName: string;
  observationCount: number;
  firstPrice: number;
  latestPrice: number;
  movementPercentage: number;
  trendDirection: QSTrendDirection;
  confidence: "sufficientHistory" | "insufficientData";
};

export type QSSupplierDecisionFlag = QsAuditFields & {
  flagId: string;
  supplierId: string;
  supplierName?: string | null;
  status: QSSupplierDecisionStatus;
  reason: QSSupplierDecisionFlagReason;
  notes?: string | null;
  setByUid: string;
  setAt: QsTimestamp;
  statusHistory: Array<{
    status: QSSupplierDecisionStatus;
    reason: QSSupplierDecisionFlagReason;
    notes?: string | null;
    setByUid: string;
    setAt: QsTimestamp;
  }>;
  version: number;
};

export type QSTransportIntelligence = {
  supplierId: string;
  supplierName: string;
  branchId?: string | null;
  branchName?: string | null;
  province?: QsProvince | null;
  city?: string | null;
  distanceKm?: number | null;
  distanceStatus: "known" | "distanceUnavailable" | "requiresBranchGps";
  deliveryFee: number;
  leadTimeDays?: number | null;
  loadingUnloadingAllowance: number;
  transportRisk: QSSupplierRiskLevel;
  deliveryConfidence: number;
  explanation: string;
};

export type QSRegionalSupplierInsight = {
  region: QsProvince;
  cheapestSupplier?: { supplierId: string; supplierName: string; landedCostExVat: number } | null;
  fastestDeliverySupplier?: { supplierId: string; supplierName: string; leadTimeDays: number } | null;
  bestRatedSupplier?: { supplierId: string; supplierName: string; score: number } | null;
  dataState: "sufficientData" | "insufficientData";
};

export type QSCommercialIntelligenceSnapshot = QsAuditFields & {
  snapshotId: string;
  commercialHealthScore: number;
  averageMarginPercentage: number;
  missingPricingCount: number;
  lowMarginEstimateCount: number;
  supplierRecommendationAcceptanceRate?: number | null;
  transportRiskSummary: Record<QSSupplierRiskLevel, number>;
  status: QsRecordStatus;
};

export type QSCommercialDashboardSummary = {
  commercialHealthScore: number;
  averageMarginPercentage: number;
  missingPricingCount: number;
  lowMarginEstimates: Array<{ estimateId: string; projectName?: string | null; marginPercentage: number; totalEstimatedProjectValue: number }>;
  supplierPerformanceLeaderboard: Array<{ supplierId: string; supplierName: string; overallSupplierScore: number; trendDirection: QSTrendDirection }>;
  savingsOpportunities: Array<{ scenarioId: string; estimateId: string; supplierName: string; costSaving: number; profitImpact: number }>;
  highestRiskSupplierMaterial?: { supplierId: string; supplierName: string; materialName: string; riskLevel: QSSupplierRiskLevel; score: number } | null;
  recommendationAcceptanceRate?: number | null;
  priceMovementSignals: QSPriceMovementSignal[];
  transportRiskSummary: Record<QSSupplierRiskLevel, number>;
  recentCommercialImpactScenarios: QSCommercialImpactScenario[];
  regionalInsights: QSRegionalSupplierInsight[];
  dataGaps: string[];
};

export type QSSupplierContactAction = QsAuditFields & {
  contactActionId: string;
  contractorId?: string | null;
  userUid: string;
  userRole?: string | null;
  supplierId: string;
  supplierName?: string | null;
  estimateId?: string | null;
  estimateLineId?: string | null;
  materialId?: string | null;
  boqLineItemId?: string | null;
  actionType: QSSupplierContactActionType;
  contactStatus: QSSupplierContactStatus;
  sourceModule: "qsSupplierIntelligence";
  notes?: string | null;
  createdByUid?: string | null;
  updatedByUid?: string | null;
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
  | "boqReviewQueue"
  | "qsEstimates"
  | "qsEstimateHistory"
  | "qsSuppliers"
  | "qsSupplierOffers"
  | "qsSupplierRecommendations"
  | "qsSupplierContactActions"
  | "qsSupplierCommercialScenarios"
  | "qsCommercialFeedback"
  | "qsSupplierPerformanceRatings"
  | "qsMaterialPriceHistory"
  | "qsSupplierDecisionFlags"
  | "qsCommercialIntelligenceSnapshots";

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
