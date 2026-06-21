const persistGovernanceEvent = jest.fn();
const fetchLiveRoarInventory = jest.fn();

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
    ref: { collectionName: name, id },
  };
}

function collection(name: string) {
  return {
    doc: (id: string) => ({
      collectionName: name,
      id,
      get: async () => snapshot(name, id),
      set: async (data: StoredDocument, options?: { merge?: boolean }) => {
        const current = collectionStore(name).get(id) ?? {};
        collectionStore(name).set(id, options?.merge ? { ...current, ...data } : data);
      },
    }),
    get: async () => ({
      docs: [...collectionStore(name).keys()].map((id) => snapshot(name, id)),
    }),
    where: (field: string, _operator: string, expected: unknown) => ({
      limit: () => ({
        get: async () => ({
          docs: [...collectionStore(name).entries()]
            .filter(([, data]) => data[field] === expected)
            .slice(0, 1)
            .map(([id]) => snapshot(name, id)),
        }),
      }),
    }),
  };
}

const db = {
  collection,
  runTransaction: async (callback: (transaction: unknown) => Promise<void>) =>
    callback({
      get: async (ref: { collectionName: string; id: string }) => snapshot(ref.collectionName, ref.id),
      set: (ref: { collectionName: string; id: string }, data: StoredDocument, options?: { merge?: boolean }) => {
        const current = collectionStore(ref.collectionName).get(ref.id) ?? {};
        collectionStore(ref.collectionName).set(ref.id, options?.merge ? { ...current, ...data } : data);
      },
    }),
  batch: () => {
    const writes: Array<{ ref: { collectionName: string; id: string }; data: StoredDocument; merge?: boolean }> = [];
    return {
      set: (ref: { collectionName: string; id: string }, data: StoredDocument, options?: { merge?: boolean }) => {
        writes.push({ ref, data, merge: options?.merge });
      },
      commit: async () => {
        for (const write of writes) {
          const current = collectionStore(write.ref.collectionName).get(write.ref.id) ?? {};
          collectionStore(write.ref.collectionName).set(
            write.ref.id,
            write.merge ? { ...current, ...write.data } : write.data,
          );
        }
      },
    };
  },
};

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: () => db }));
jest.mock("@/lib/governance/persistence", () => ({
  persistGovernanceEvent: (...args: unknown[]) => persistGovernanceEvent(...args),
}));
jest.mock("@/lib/vehicle-finance/roarInventory", () => ({
  ROAR_INVENTORY_SOURCE_URL: "https://roarcarssa.com/inventory.html",
  fetchLiveRoarInventory: (...args: unknown[]) => fetchLiveRoarInventory(...args),
}));

import { getPersistedRoarInventory, synchronizeRoarInventory } from "@/lib/vehicle-finance/inventory/durableInventorySync";
import type { RoarInventoryVehicle } from "@/types/roarInventory";

function vehicle(id: string, overrides: Partial<RoarInventoryVehicle> = {}): RoarInventoryVehicle {
  return {
    id,
    title: `Vehicle ${id}`,
    make: "BMW",
    model: id,
    year: 2022,
    price: 500000,
    priceNumber: 500000,
    mileage: 40000,
    mileageNumber: 40000,
    transmission: "Automatic",
    fuelType: "Petrol",
    bodyType: "Sedan",
    imageUrl: `https://roarcarssa.com/images/${id}.jpg`,
    listingUrl: `https://roarcarssa.com/vehicle/${id}`,
    status: "ACTIVE",
    source: "roarcarssa.com",
    lastSyncedAt: "2026-06-21T00:00:00.000Z",
    ...overrides,
  };
}

function sourceResponse(vehicles: RoarInventoryVehicle[]) {
  return {
    vehicles,
    metrics: { activeVehicles: vehicles.length, inventoryValue: 0, averageVehiclePrice: 0, averageModelAge: null, vehiclesAddedThisMonth: null },
    status: "LIVE",
    syncedAt: new Date().toISOString(),
    sourceUrl: "https://roarcarssa.com/inventory.html",
    itemCount: vehicles.length,
    source: { type: "static-html", url: "https://roarcarssa.com/inventory.html", lastSyncedAt: new Date().toISOString() },
  };
}

describe("durable inventory synchronization", () => {
  beforeEach(() => {
    collections.clear();
    jest.clearAllMocks();
    persistGovernanceEvent.mockResolvedValue(undefined);
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("persists unique vehicles and records sync/create governance events", async () => {
    fetchLiveRoarInventory.mockResolvedValue(
      sourceResponse([vehicle("stock-1"), vehicle("stock-duplicate", { listingUrl: "https://roarcarssa.com/vehicle/stock-1" }), vehicle("stock-2")]),
    );

    const result = await synchronizeRoarInventory({ actorId: "test", actorRole: "system" });
    const persisted = await getPersistedRoarInventory();

    expect(result).toEqual(expect.objectContaining({
      totalVehiclesReceived: 3,
      totalVehiclesStored: 2,
      duplicateVehicles: 1,
      vehiclesCreated: 2,
      missingVehicles: 0,
      brokenImageLinks: 0,
    }));
    expect(persisted.itemCount).toBe(2);
    expect(persisted.metrics.activeVehicles).toBe(2);
    expect(persistGovernanceEvent.mock.calls.map(([event]) => event.eventType)).toEqual(
      expect.arrayContaining(["inventory_sync_started", "inventory_sync_succeeded", "inventory_vehicle_created"]),
    );
  });

  test("updates changed vehicles and inactivates vehicles missing from the next successful feed", async () => {
    fetchLiveRoarInventory.mockResolvedValueOnce(sourceResponse([vehicle("stock-1"), vehicle("stock-2")]));
    await synchronizeRoarInventory();

    fetchLiveRoarInventory.mockResolvedValueOnce(sourceResponse([vehicle("stock-1", { price: 475000, priceNumber: 475000 })]));
    const result = await synchronizeRoarInventory();
    const persisted = await getPersistedRoarInventory();

    expect(result).toEqual(expect.objectContaining({
      totalVehiclesStored: 2,
      vehiclesUpdated: 1,
      vehiclesInactivated: 1,
      missingVehicles: 1,
    }));
    expect(persisted.itemCount).toBe(2);
    expect(persisted.metrics.activeVehicles).toBe(1);
    expect(persisted.vehicles.find((item) => item.id === "stock-2")?.status).toBe("INACTIVE");
  });
});
