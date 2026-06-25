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
} as const satisfies Record<string, QsFirestoreCollection>;
