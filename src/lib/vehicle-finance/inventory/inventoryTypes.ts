export type VehicleInventoryStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "IN_TRANSIT" | "PENDING";

export type VehicleInventoryRecord = {
  stockNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVariant: string;
  vehiclePrice: number;
  yearModel: number;
  mileage: number;
  status: VehicleInventoryStatus;
};

export type VehicleInventoryMatch = {
  stockNumber: string;
  suitableVehicleBand: "STARTER" | "MID_RANGE" | "PREMIUM" | "OUT_OF_RANGE";
  affordabilityMatch: number;
  financeSuitability: "HIGH" | "MEDIUM" | "LOW";
};
