const fetchLiveRoarInventory = jest.fn();
const getPersistedRoarInventory = jest.fn();
const synchronizeRoarInventory = jest.fn();

type StoredDocument = Record<string, unknown>;
const collections = new Map<string, Map<string, StoredDocument>>();

function collectionStore(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function snapshot(name: string, id: string) {
  const value = collectionStore(name).get(id);
  return {
    id,
    exists: Boolean(value),
    data: () => value,
  };
}

const db = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => snapshot(name, id),
      set: async (data: StoredDocument, options?: { merge?: boolean }) => {
        const current = collectionStore(name).get(id) ?? {};
        collectionStore(name).set(id, options?.merge ? { ...current, ...data } : data);
      },
    }),
  }),
};

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: () => db }));
jest.mock("@/lib/vehicle-finance/roarInventory", () => ({
  ROAR_INVENTORY_SOURCE_URL: "https://roarcarssa.com/inventory.html",
  fetchLiveRoarInventory: (...args: unknown[]) => fetchLiveRoarInventory(...args),
}));
jest.mock("@/lib/vehicle-finance/inventory/durableInventorySync", () => ({
  getPersistedRoarInventory: (...args: unknown[]) => getPersistedRoarInventory(...args),
  synchronizeRoarInventory: (...args: unknown[]) => synchronizeRoarInventory(...args),
}));

import {
  getInventoryHealth,
  normalizeRoarConnectorVehicle,
  recordSyncAttempt,
  syncInventory,
  VEHICLE_INVENTORY_SYNC_RUNS_COLLECTION,
} from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import type { RoarInventoryResponse } from "@/types/roarInventory";

function inventoryResponse(overrides: Partial<RoarInventoryResponse> = {}): RoarInventoryResponse {
  return {
    vehicles: [
      {
        id: "stock-1",
        title: "2022 BMW 320i",
        make: "BMW",
        model: "320i",
        year: 2022,
        price: 500000,
        priceNumber: 500000,
        mileage: 40000,
        mileageNumber: 40000,
        transmission: "Automatic",
        fuelType: "Petrol",
        bodyType: "Sedan",
        imageUrl: "/images/roar-cars-placeholder.svg",
        listingUrl: "https://roarcarssa.com/vehicle/stock-1",
        status: "ACTIVE",
        source: "roarcarssa.com",
        lastSyncedAt: "2026-06-28T00:00:00.000Z",
      },
    ],
    metrics: { activeVehicles: 1, inventoryValue: 500000, averageVehiclePrice: 500000, averageModelAge: 4, vehiclesAddedThisMonth: 1 },
    status: "LIVE",
    syncedAt: "2026-06-28T00:00:00.000Z",
    sourceUrl: "https://roarcarssa.com/inventory.html",
    itemCount: 1,
    source: { type: "firestore", url: "https://roarcarssa.com/inventory.html", lastSyncedAt: "2026-06-28T00:00:00.000Z" },
    diagnostics: {
      totalVehiclesReceived: 1,
      totalVehiclesStored: 1,
      missingVehicles: 0,
      duplicateVehicles: 0,
      failedSyncs: 0,
      brokenImageLinks: 1,
      vehiclesCreated: 1,
      vehiclesUpdated: 0,
      vehiclesInactivated: 0,
      lastSyncDurationMs: 100,
      lastSyncError: null,
    },
    ...overrides,
  };
}

describe("Roar Cars inventory connector", () => {
  beforeEach(() => {
    collections.clear();
    jest.clearAllMocks();
    getPersistedRoarInventory.mockResolvedValue(inventoryResponse());
  });

  test("normalizes vehicles without exposing raw source snapshots", () => {
    const normalized = normalizeRoarConnectorVehicle({
      id: "stock-1",
      make: "BMW",
      model: "320i",
      year: 2022,
      priceNumber: 500000,
      mileageNumber: 40000,
      imageUrl: "",
      listingUrl: "https://roarcarssa.com/vehicle/stock-1",
      status: "ACTIVE",
      rawSourceSnapshot: { secret: "server-only" },
    }, "sync-1");

    expect(normalized.vehicleId).toBe("stock-1");
    expect(normalized.missingImage).toBe(true);
    expect(normalized).not.toHaveProperty("rawSourceSnapshot");
  });

  test("calculates connector health from persisted inventory and diagnostics", async () => {
    const health = await getInventoryHealth();

    expect(health.vehicleCount).toBe(1);
    expect(health.activeVehicleCount).toBe(1);
    expect(health.failedImageCount).toBe(1);
    expect(health.sourceUrl).toContain("roarcarssa.com");
  });

  test("records failed sync attempts safely", async () => {
    const run = await recordSyncAttempt({
      status: "FAILED",
      error: "source unavailable",
      triggeredByUid: "staff-1",
    });

    const stored = collectionStore(VEHICLE_INVENTORY_SYNC_RUNS_COLLECTION).get(run.syncRunId);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.error).toBe("source unavailable");
    expect(stored).not.toHaveProperty("undefined");
  });

  test("records successful connector sync and updates config", async () => {
    synchronizeRoarInventory.mockResolvedValue({
      syncRunId: "sync-1",
      status: "SUCCEEDED",
      startedAt: "2026-06-28T00:00:00.000Z",
      completedAt: "2026-06-28T00:01:00.000Z",
      totalVehiclesReceived: 1,
      totalVehiclesStored: 1,
      missingVehicles: 0,
      duplicateVehicles: 0,
      failedSyncs: 0,
      brokenImageLinks: 0,
      vehiclesCreated: 1,
      vehiclesUpdated: 0,
      vehiclesInactivated: 0,
      lastSyncDurationMs: 100,
      lastSyncError: null,
      sourceType: "firestore",
    });

    const result = await syncInventory({ actorId: "staff-1", actorRole: "vehicleFinanceStaff" });

    expect(result.result.status).toBe("SUCCEEDED");
    expect(result.config.status).toBe("CONNECTED");
    expect(collectionStore(VEHICLE_INVENTORY_SYNC_RUNS_COLLECTION).has("sync-1")).toBe(true);
  });
});
