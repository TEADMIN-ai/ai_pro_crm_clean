import type { VehicleInventoryRecord } from "./inventoryTypes";

const VEHICLE_INVENTORY: VehicleInventoryRecord[] = [];

export function listVehicleInventory(): VehicleInventoryRecord[] {
  return VEHICLE_INVENTORY;
}

export function registerVehicleInventory(record: VehicleInventoryRecord): VehicleInventoryRecord {
  VEHICLE_INVENTORY.push(record);
  return record;
}
