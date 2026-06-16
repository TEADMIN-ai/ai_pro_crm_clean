export interface VehicleFinanceFeatureFlags {
  ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: boolean;
}

export type VehicleFinanceFlagResolution = {
  flagNameFound: "VEHICLE_FINANCE_LICENCE_INTELLIGENCE" | "ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE" | "PRODUCTION_DEFAULT";
  resolvedValue: boolean;
  source: "env" | "production-default" | "disabled";
};

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveVehicleFinanceLicenceIntelligenceFlag(): VehicleFinanceFlagResolution {
  const explicitPrimary = process.env.VEHICLE_FINANCE_LICENCE_INTELLIGENCE;
  const explicitFallback = process.env.ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE;
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  if (typeof explicitPrimary === "string") {
    return {
      flagNameFound: "VEHICLE_FINANCE_LICENCE_INTELLIGENCE",
      resolvedValue: parseBoolean(explicitPrimary) || isProduction,
      source: "env",
    };
  }

  if (typeof explicitFallback === "string") {
    return {
      flagNameFound: "ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE",
      resolvedValue: parseBoolean(explicitFallback) || isProduction,
      source: "env",
    };
  }

  return {
    flagNameFound: "PRODUCTION_DEFAULT",
    resolvedValue: isProduction,
    source: isProduction ? "production-default" : "disabled",
  };
}

export function getVehicleFinanceFeatureFlags(): VehicleFinanceFeatureFlags {
  const licenceIntelligence = resolveVehicleFinanceLicenceIntelligenceFlag().resolvedValue;

  return {
    ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: licenceIntelligence,
  };
}

export function isVehicleFinanceFeatureEnabled(flag: keyof VehicleFinanceFeatureFlags): boolean {
  return getVehicleFinanceFeatureFlags()[flag];
}
