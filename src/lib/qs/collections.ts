import type { QsFirestoreCollection } from "@/types/qs";

export const QS_COLLECTIONS = {
  materials: "materials",
  materialCategories: "materialCategories",
  materialPrices: "materialPrices",
  suppliers: "suppliers",
  supplierPrices: "supplierPrices",
  priceHistory: "priceHistory",
  unitMeasurements: "unitMeasurements",
  brands: "brands",
  materialAvailability: "materialAvailability",
  materialImports: "materialImports",
  importLogs: "importLogs",
  failedImports: "failedImports",
  importProfiles: "importProfiles",
  boqDocuments: "boqDocuments",
  boqLineItems: "boqLineItems",
  boqTrades: "boqTrades",
  boqExtractionLogs: "boqExtractionLogs",
  boqReviewQueue: "boqReviewQueue",
  qsEstimates: "qsEstimates",
  qsEstimateHistory: "qsEstimateHistory",
} as const satisfies Record<string, QsFirestoreCollection>;
