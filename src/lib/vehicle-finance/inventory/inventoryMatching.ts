import type { VehicleInventoryMatch, VehicleInventoryRecord } from "./inventoryTypes";

export function matchVehicleToAffordability(
  vehicle: VehicleInventoryRecord,
  maxAffordableInstalment: number,
): VehicleInventoryMatch {
  const affordabilityMatch = Math.max(0, Math.min(100, Math.round((maxAffordableInstalment / Math.max(vehicle.vehiclePrice, 1)) * 100)));
  const suitableVehicleBand =
    vehicle.vehiclePrice <= maxAffordableInstalment * 6
      ? "STARTER"
      : vehicle.vehiclePrice <= maxAffordableInstalment * 12
        ? "MID_RANGE"
        : vehicle.vehiclePrice <= maxAffordableInstalment * 18
          ? "PREMIUM"
          : "OUT_OF_RANGE";

  const financeSuitability =
    affordabilityMatch >= 80 ? "HIGH" : affordabilityMatch >= 55 ? "MEDIUM" : "LOW";

  return {
    stockNumber: vehicle.stockNumber,
    suitableVehicleBand,
    affordabilityMatch,
    financeSuitability,
  };
}
