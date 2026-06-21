import {
  normalizeRoarInventoryImageUrl,
  parseRoarInventoryMileage,
  parseRoarInventoryPrice,
  parseRoarInventoryTitle,
  isRetriableRoarInventoryStatus,
} from "@/lib/vehicle-finance/roarInventory";
import {
  deduplicateInventoryVehicles,
  findMissingAvailableInventoryVehicles,
  getInventoryCanonicalKey,
  isInventoryVehicleAvailable,
  type PersistedInventoryVehicle,
} from "@/lib/vehicle-finance/inventory/durableInventorySync";
import type { RoarInventoryVehicle } from "@/types/roarInventory";

function inventoryVehicle(overrides: Partial<RoarInventoryVehicle> = {}): RoarInventoryVehicle {
  return {
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
    imageUrl: "https://roarcarssa.com/images/bmw.jpg",
    listingUrl: "https://roarcarssa.com/vehicle/bmw-320i",
    status: "ACTIVE",
    source: "roarcarssa.com",
    lastSyncedAt: "2026-06-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("Roar inventory utilities", () => {
  it("parses price strings to numbers", () => {
    expect(parseRoarInventoryPrice("R889 950")).toBe(889950);
  });

  it("parses mileage strings to numbers", () => {
    expect(parseRoarInventoryMileage("68 898km")).toBe(68898);
  });

  it("normalizes relative image URLs", () => {
    expect(normalizeRoarInventoryImageUrl("/images/bmw.jpg", "https://roarcarssa.com/inventory.html")).toBe(
      "https://roarcarssa.com/images/bmw.jpg",
    );
  });

  it("infers title, make, model, and year from the listing title", () => {
    expect(parseRoarInventoryTitle("Volkswagen Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line 2019")).toEqual(
      expect.objectContaining({
        title: "Volkswagen Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line 2019",
        make: "Volkswagen",
        model: "Tiguan Allspace 2.0 TSI 4 Motion Comfortline R-Line",
        year: 2019,
      }),
    );
  });

  it("deduplicates vehicles by source identity and listing URL", () => {
    const first = inventoryVehicle();
    const duplicateUrl = inventoryVehicle({ id: "stock-2" });
    const unique = inventoryVehicle({ id: "stock-3", listingUrl: "https://roarcarssa.com/vehicle/golf" });

    expect(deduplicateInventoryVehicles([first, duplicateUrl, unique])).toEqual({
      vehicles: [first, unique],
      duplicateCount: 1,
    });
  });

  it("classifies unavailable statuses and finds vehicles missing from a successful feed", () => {
    expect(isInventoryVehicleAvailable("ACTIVE")).toBe(true);
    expect(isInventoryVehicleAvailable("RESERVED")).toBe(false);
    expect(isInventoryVehicleAvailable("SOLD")).toBe(false);

    const existing = {
      ...inventoryVehicle(),
      firestoreId: "firestore-1",
      recordType: "vehicle",
      sourceVehicleId: "stock-1",
      canonicalKey: getInventoryCanonicalKey(inventoryVehicle()),
      contentHash: "hash",
      isAvailable: true,
      imageStatus: "VALID",
      originalImageUrl: null,
      firstSyncedAt: "2026-06-20T00:00:00.000Z",
      lastSeenAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
      unavailableSince: null,
      syncRunId: "run-1",
    } satisfies PersistedInventoryVehicle;

    expect(findMissingAvailableInventoryVehicles([existing], new Set())).toEqual([existing]);
    expect(findMissingAvailableInventoryVehicles([existing], new Set([existing.canonicalKey]))).toEqual([]);
  });

  it("retries transient HTTP statuses only", () => {
    expect(isRetriableRoarInventoryStatus(408)).toBe(true);
    expect(isRetriableRoarInventoryStatus(429)).toBe(true);
    expect(isRetriableRoarInventoryStatus(503)).toBe(true);
    expect(isRetriableRoarInventoryStatus(404)).toBe(false);
  });
});
