export type RoarInventorySourceType = "api" | "json-ld" | "static-html" | "firestore" | "cached" | "unavailable";

export type RoarInventoryVehicle = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number | null;
  price: number | null;
  priceNumber: number | null;
  mileage: number | null;
  mileageNumber: number | null;
  transmission: string | null;
  fuelType: string | null;
  bodyType: string | null;
  imageUrl: string | null;
  listingUrl: string;
  status: string;
  source: string;
  lastSyncedAt: string;
};

export type RoarInventoryMetrics = {
  activeVehicles: number;
  inventoryValue: number;
  averageVehiclePrice: number;
  averageModelAge: number | null;
  vehiclesAddedThisMonth: number | null;
};

export type RoarInventoryDiagnostics = {
  totalVehiclesReceived: number;
  totalVehiclesStored: number;
  missingVehicles: number;
  duplicateVehicles: number;
  failedSyncs: number;
  brokenImageLinks: number;
  vehiclesCreated: number;
  vehiclesUpdated: number;
  vehiclesInactivated: number;
  lastSyncDurationMs: number | null;
  lastSyncError: string | null;
};

export type RoarInventoryResponse = {
  vehicles: RoarInventoryVehicle[];
  metrics: RoarInventoryMetrics;
  status: "LIVE" | "CACHED" | "UNAVAILABLE";
  syncedAt: string;
  sourceUrl: string;
  itemCount: number;
  source: {
    type: RoarInventorySourceType;
    url: string;
    lastSyncedAt: string;
  };
  diagnostics?: RoarInventoryDiagnostics;
  warning?: string;
};
