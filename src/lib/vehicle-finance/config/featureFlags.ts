export interface VehicleFinanceFeatureFlags {
  ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: boolean;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getVehicleFinanceFeatureFlags(): VehicleFinanceFeatureFlags {
  const licenceIntelligence = parseBoolean(
    process.env.VEHICLE_FINANCE_LICENCE_INTELLIGENCE ?? process.env.ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE,
  );

  return {
    ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: licenceIntelligence,
  };
}

export function isVehicleFinanceFeatureEnabled(flag: keyof VehicleFinanceFeatureFlags): boolean {
  return getVehicleFinanceFeatureFlags()[flag];
}
