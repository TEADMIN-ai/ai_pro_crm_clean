export type RoarInventorySourceType = "api" | "json-ld" | "static-html" | "firestore" | "cached" | "unavailable";

export type RoarConnectorProviderName = "ROAR_CARS";
export type RoarConnectorStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "NEEDS_ATTENTION";
export type RoarConnectorSourceType = "API" | "WEBHOOK" | "MANUAL_IMPORT" | "VERCEL_CONNECT";
export type RoarConnectorTokenStatus = "notRequired" | "configured" | "missing" | "expired" | "managedByVercelConnect" | "unknown";
export type RoarConnectorEnvironment = "development" | "preview" | "production" | "unknown";

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

export type RoarNormalizedVehicle = {
  vehicleId: string;
  make: string;
  model: string;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  stockNumber: string | null;
  vin: string | null;
  registration: string | null;
  transmission: string | null;
  fuelType: string | null;
  bodyType: string | null;
  colour: string | null;
  imageUrls: string[];
  primaryImageUrl: string | null;
  listingUrl: string;
  source: string;
  sourceUpdatedAt: string | null;
  syncBatchId: string;
  isActive: boolean;
  missingImage: boolean;
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

export type RoarConnectorConfig = {
  connectorId: string;
  providerName: RoarConnectorProviderName;
  status: RoarConnectorStatus;
  sourceType: RoarConnectorSourceType;
  baseUrl: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  tokenStatus: RoarConnectorTokenStatus;
  createdAt: string;
  updatedAt: string;
  updatedByUid?: string | null;
  environment: RoarConnectorEnvironment;
  enabled: boolean;
};

export type RoarInventorySyncRun = {
  syncRunId: string;
  connectorId: string;
  status: "STARTED" | "SUCCEEDED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  vehicleCount: number;
  activeVehicleCount: number;
  missingImageCount: number;
  failedImageCount: number;
  sourceType: string | null;
  error: string | null;
  triggeredByUid?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoarInventoryConnectorHealth = {
  connectorId: string;
  providerName: RoarConnectorProviderName;
  connectorStatus: RoarConnectorStatus;
  sourceHealth: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";
  syncStatus: "LIVE" | "CACHED" | "UNAVAILABLE" | "RUNNING" | "FAILED" | "NOT_CONFIGURED";
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  vehicleCount: number;
  activeVehicleCount: number;
  missingImageCount: number;
  failedImageCount: number;
  lastError: string | null;
  tokenStatus: RoarConnectorTokenStatus;
  sourceType: RoarConnectorSourceType;
  sourceUrl: string;
  retryAvailable: boolean;
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
