import "server-only";

import crypto from "node:crypto";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { fetchLiveRoarInventory, ROAR_INVENTORY_SOURCE_URL } from "@/lib/vehicle-finance/roarInventory";
import {
  getPersistedRoarInventory,
  synchronizeRoarInventory,
  type InventorySyncResult,
} from "@/lib/vehicle-finance/inventory/durableInventorySync";
import type {
  RoarConnectorConfig,
  RoarConnectorEnvironment,
  RoarConnectorSourceType,
  RoarInventoryConnectorHealth,
  RoarInventoryResponse,
  RoarInventorySyncRun,
  RoarInventoryVehicle,
  RoarNormalizedVehicle,
} from "@/types/roarInventory";

export const ROAR_CARS_CONNECTOR_ID = "roar-cars-inventory";
export const VEHICLE_FINANCE_CONNECTORS_COLLECTION = "vehicleFinanceConnectors";
export const VEHICLE_INVENTORY_SYNC_RUNS_COLLECTION = "vehicleInventorySyncRuns";
export const VEHICLE_INVENTORY_HEALTH_COLLECTION = "vehicleInventoryHealth";

const PLACEHOLDER_IMAGE_URL = "/images/roar-cars-placeholder.svg";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sanitizeFirestoreData(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, sanitizeFirestoreData(entryValue)]),
    ) as T;
  }
  return value;
}

function normalizeEnv(value: string | undefined): RoarConnectorEnvironment {
  if (value === "production" || value === "preview" || value === "development") return value;
  return "unknown";
}

function connectorBaseUrl(): string {
  return process.env.ROAR_CARS_INVENTORY_BASE_URL?.trim() || ROAR_INVENTORY_SOURCE_URL;
}

function connectorSourceType(): RoarConnectorSourceType {
  const configured = process.env.ROAR_CARS_CONNECTOR_SOURCE_TYPE?.trim().toUpperCase();
  if (configured === "VERCEL_CONNECT" || configured === "WEBHOOK" || configured === "MANUAL_IMPORT" || configured === "API") {
    return configured;
  }
  return "API";
}

function connectorTokenStatus(sourceType: RoarConnectorSourceType): RoarConnectorConfig["tokenStatus"] {
  if (sourceType === "VERCEL_CONNECT") return "managedByVercelConnect";
  if (process.env.ROAR_CARS_API_TOKEN?.trim()) return "configured";
  return "notRequired";
}

function defaultConnectorConfig(): RoarConnectorConfig {
  const timestamp = nowIso();
  const sourceType = connectorSourceType();
  return {
    connectorId: ROAR_CARS_CONNECTOR_ID,
    providerName: "ROAR_CARS",
    status: "DISCONNECTED",
    sourceType,
    baseUrl: connectorBaseUrl(),
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    lastError: null,
    tokenStatus: connectorTokenStatus(sourceType),
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedByUid: null,
    environment: normalizeEnv(process.env.VERCEL_ENV ?? process.env.NODE_ENV),
    enabled: false,
  };
}

function isActiveStatus(status: string | null | undefined): boolean {
  return !/sold|inactive|reserved|unavailable/i.test(status ?? "");
}

function normalizeImageUrls(vehicle: Partial<RoarInventoryVehicle> & Record<string, unknown>): string[] {
  const values = [
    vehicle.imageUrl,
    ...(Array.isArray(vehicle.imageUrls) ? vehicle.imageUrls : []),
  ];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))]
    .map((value) => value.trim())
    .filter((value) => !value.startsWith("data:"));
}

export function normalizeRoarConnectorVehicle(
  sourceVehicle: Partial<RoarInventoryVehicle> & Record<string, unknown>,
  syncBatchId: string,
): RoarNormalizedVehicle {
  const imageUrls = normalizeImageUrls(sourceVehicle);
  const vehicleId = String(sourceVehicle.id ?? sourceVehicle.stockNumber ?? sourceVehicle.listingUrl ?? crypto.randomUUID()).trim();
  return {
    vehicleId,
    make: String(sourceVehicle.make ?? "").trim(),
    model: String(sourceVehicle.model ?? "").trim(),
    variant: typeof sourceVehicle.variant === "string" ? sourceVehicle.variant.trim() || null : null,
    year: typeof sourceVehicle.year === "number" ? sourceVehicle.year : null,
    mileage: typeof sourceVehicle.mileageNumber === "number" ? sourceVehicle.mileageNumber : typeof sourceVehicle.mileage === "number" ? sourceVehicle.mileage : null,
    price: typeof sourceVehicle.priceNumber === "number" ? sourceVehicle.priceNumber : typeof sourceVehicle.price === "number" ? sourceVehicle.price : null,
    stockNumber: typeof sourceVehicle.stockNumber === "string" ? sourceVehicle.stockNumber.trim() || null : vehicleId,
    vin: typeof sourceVehicle.vin === "string" ? sourceVehicle.vin.trim() || null : null,
    registration: typeof sourceVehicle.registration === "string" ? sourceVehicle.registration.trim() || null : null,
    transmission: typeof sourceVehicle.transmission === "string" ? sourceVehicle.transmission.trim() || null : null,
    fuelType: typeof sourceVehicle.fuelType === "string" ? sourceVehicle.fuelType.trim() || null : null,
    bodyType: typeof sourceVehicle.bodyType === "string" ? sourceVehicle.bodyType.trim() || null : null,
    colour: typeof sourceVehicle.colour === "string" ? sourceVehicle.colour.trim() || null : null,
    imageUrls,
    primaryImageUrl: imageUrls[0] ?? null,
    listingUrl: String(sourceVehicle.listingUrl ?? "").trim(),
    source: String(sourceVehicle.source ?? "roarcarssa.com").trim(),
    sourceUpdatedAt: typeof sourceVehicle.lastSyncedAt === "string" ? sourceVehicle.lastSyncedAt : null,
    syncBatchId,
    isActive: isActiveStatus(String(sourceVehicle.status ?? "ACTIVE")),
    missingImage: imageUrls.length === 0 || imageUrls[0] === PLACEHOLDER_IMAGE_URL,
  };
}

export function toFrontendSafeVehicle(vehicle: RoarNormalizedVehicle): RoarNormalizedVehicle {
  return { ...vehicle };
}

async function connectorDoc() {
  return getFirebaseAdmin().collection(VEHICLE_FINANCE_CONNECTORS_COLLECTION).doc(ROAR_CARS_CONNECTOR_ID);
}

async function healthDoc() {
  return getFirebaseAdmin().collection(VEHICLE_INVENTORY_HEALTH_COLLECTION).doc(ROAR_CARS_CONNECTOR_ID);
}

export async function getRoarConnectorConfig(): Promise<RoarConnectorConfig> {
  const snapshot = await (await connectorDoc()).get();
  if (!snapshot.exists) return defaultConnectorConfig();
  return { ...defaultConnectorConfig(), ...snapshot.data(), connectorId: ROAR_CARS_CONNECTOR_ID } as RoarConnectorConfig;
}

async function persistConnectorConfig(updates: Partial<RoarConnectorConfig>): Promise<RoarConnectorConfig> {
  const existing = await getRoarConnectorConfig();
  const next = sanitizeFirestoreData({
    ...existing,
    ...updates,
    connectorId: ROAR_CARS_CONNECTOR_ID,
    providerName: "ROAR_CARS",
    updatedAt: nowIso(),
  });
  await (await connectorDoc()).set(next, { merge: true });
  return next as RoarConnectorConfig;
}

function healthFromInventory(config: RoarConnectorConfig, inventory: RoarInventoryResponse): RoarInventoryConnectorHealth {
  const diagnostics = inventory.diagnostics;
  const failedImageCount = diagnostics?.brokenImageLinks ?? 0;
  const missingImageCount = inventory.vehicles.filter((vehicle) => !vehicle.imageUrl || vehicle.imageUrl === PLACEHOLDER_IMAGE_URL).length;
  const sourceHealth = config.status === "DISCONNECTED"
    ? "NOT_CONFIGURED"
    : inventory.status === "LIVE" && !inventory.warning
      ? "HEALTHY"
      : inventory.status === "CACHED"
        ? "DEGRADED"
        : "UNAVAILABLE";

  return {
    connectorId: ROAR_CARS_CONNECTOR_ID,
    providerName: "ROAR_CARS",
    connectorStatus: config.status,
    sourceHealth,
    syncStatus: inventory.status,
    lastSuccessfulSyncAt: config.lastSuccessfulSyncAt ?? inventory.source.lastSyncedAt ?? null,
    lastAttemptedSyncAt: config.lastSyncAt ?? (typeof diagnostics?.lastSyncDurationMs === "number" ? inventory.syncedAt : null),
    vehicleCount: inventory.itemCount,
    activeVehicleCount: inventory.metrics.activeVehicles,
    missingImageCount,
    failedImageCount,
    lastError: config.lastError ?? diagnostics?.lastSyncError ?? null,
    tokenStatus: config.tokenStatus,
    sourceType: config.sourceType,
    sourceUrl: inventory.source.url || config.baseUrl,
    retryAvailable: config.tokenStatus !== "missing",
  };
}

async function persistHealth(health: RoarInventoryConnectorHealth): Promise<RoarInventoryConnectorHealth> {
  const payload = sanitizeFirestoreData({ ...health, updatedAt: nowIso() });
  await (await healthDoc()).set(payload, { merge: true });
  return health;
}

export async function recordSyncAttempt(input: {
  status: RoarInventorySyncRun["status"];
  syncRunId?: string;
  startedAt?: string;
  completedAt?: string | null;
  vehicleCount?: number;
  activeVehicleCount?: number;
  missingImageCount?: number;
  failedImageCount?: number;
  sourceType?: string | null;
  error?: string | null;
  triggeredByUid?: string | null;
}): Promise<RoarInventorySyncRun> {
  const timestamp = nowIso();
  const syncRunId = input.syncRunId ?? crypto.randomUUID();
  const run: RoarInventorySyncRun = {
    syncRunId,
    connectorId: ROAR_CARS_CONNECTOR_ID,
    status: input.status,
    startedAt: input.startedAt ?? timestamp,
    completedAt: input.completedAt ?? (input.status === "STARTED" ? null : timestamp),
    vehicleCount: input.vehicleCount ?? 0,
    activeVehicleCount: input.activeVehicleCount ?? 0,
    missingImageCount: input.missingImageCount ?? 0,
    failedImageCount: input.failedImageCount ?? 0,
    sourceType: input.sourceType ?? null,
    error: input.error ?? null,
    triggeredByUid: input.triggeredByUid ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await getFirebaseAdmin()
    .collection(VEHICLE_INVENTORY_SYNC_RUNS_COLLECTION)
    .doc(syncRunId)
    .set(sanitizeFirestoreData(run), { merge: true });
  return run;
}

export async function fetchInventory(): Promise<RoarInventoryResponse> {
  return getPersistedRoarInventory({ bootstrapIfEmpty: true });
}

export async function validateConnection(updatedByUid?: string | null): Promise<{ ok: boolean; config: RoarConnectorConfig; vehicleCount: number; error?: string }> {
  try {
    const response = await fetchLiveRoarInventory();
    const config = await persistConnectorConfig({
      status: "CONNECTED",
      enabled: true,
      sourceType: response.source.type === "api" ? "API" : connectorSourceType(),
      baseUrl: response.source.url || connectorBaseUrl(),
      tokenStatus: connectorTokenStatus(connectorSourceType()),
      lastError: null,
      updatedByUid: updatedByUid ?? null,
    });
    return { ok: true, config, vehicleCount: response.itemCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roar Cars connector validation failed";
    const config = await persistConnectorConfig({
      status: "ERROR",
      enabled: false,
      lastError: message,
      updatedByUid: updatedByUid ?? null,
    });
    return { ok: false, config, vehicleCount: 0, error: message };
  }
}

export async function getInventoryHealth(): Promise<RoarInventoryConnectorHealth> {
  const [config, inventory] = await Promise.all([
    getRoarConnectorConfig(),
    getPersistedRoarInventory({ bootstrapIfEmpty: false }),
  ]);
  return persistHealth(healthFromInventory(config, inventory));
}

function metricsFromSyncResult(result: InventorySyncResult) {
  return {
    vehicleCount: result.totalVehiclesStored,
    activeVehicleCount: Math.max(0, result.totalVehiclesStored - result.vehiclesInactivated),
    missingImageCount: result.brokenImageLinks,
    failedImageCount: result.brokenImageLinks,
  };
}

export async function syncInventory(actor?: { actorId?: string; actorEmail?: string; actorRole?: string }): Promise<{
  result: InventorySyncResult;
  config: RoarConnectorConfig;
  health: RoarInventoryConnectorHealth;
}> {
  const startedAt = nowIso();
  await recordSyncAttempt({ status: "STARTED", startedAt, triggeredByUid: actor?.actorId ?? null });
  await persistConnectorConfig({ status: "NEEDS_ATTENTION", lastSyncAt: startedAt, lastError: null, updatedByUid: actor?.actorId ?? null });

  try {
    const result = await synchronizeRoarInventory(actor);
    const metrics = metricsFromSyncResult(result);
    await recordSyncAttempt({
      status: "SUCCEEDED",
      syncRunId: result.syncRunId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      sourceType: result.sourceType,
      triggeredByUid: actor?.actorId ?? null,
      ...metrics,
    });
    const config = await persistConnectorConfig({
      status: "CONNECTED",
      enabled: true,
      lastSyncAt: result.completedAt,
      lastSuccessfulSyncAt: result.completedAt,
      lastError: null,
      updatedByUid: actor?.actorId ?? null,
    });
    const health = await getInventoryHealth();
    return { result, config, health };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory connector sync failed";
    await recordSyncAttempt({ status: "FAILED", startedAt, error: message, triggeredByUid: actor?.actorId ?? null });
    await persistConnectorConfig({ status: "ERROR", lastSyncAt: nowIso(), lastError: message, updatedByUid: actor?.actorId ?? null });
    throw error;
  }
}

export function retrySync(actor?: { actorId?: string; actorEmail?: string; actorRole?: string }) {
  return syncInventory(actor);
}

/**
 * Vercel Connect readiness:
 * - Today this connector uses the existing env/source integration path.
 * - Future Vercel Connect token retrieval should plug in before fetchLiveRoarInventory()
 *   and replace ROAR_CARS_API_TOKEN / public-source access with managed connector tokens.
 * - Required future scopes: inventory read, listing media read, listing URL read, and webhook read if enabled.
 * - No Vercel Connect SDK is installed in this repository, so this layer intentionally exposes
 *   sourceType="VERCEL_CONNECT" and tokenStatus="managedByVercelConnect" without inventing SDK calls.
 */
