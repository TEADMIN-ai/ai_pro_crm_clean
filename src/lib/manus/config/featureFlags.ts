export interface ManusFeatureFlags {
  ENABLE_MANUS_WORKFLOWS: boolean;
  ENABLE_MANUS_TENDER_FLOW: boolean;
  ENABLE_MANUS_MEMORY: boolean;
  ENABLE_MANUS_NOTIFICATIONS: boolean;
  ENABLE_MANUS_AUTO_ACTIONS: boolean;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getManusFeatureFlags(): ManusFeatureFlags {
  return {
    ENABLE_MANUS_WORKFLOWS: parseBoolean(process.env.ENABLE_MANUS_WORKFLOWS),
    ENABLE_MANUS_TENDER_FLOW: parseBoolean(process.env.ENABLE_MANUS_TENDER_FLOW),
    ENABLE_MANUS_MEMORY: parseBoolean(process.env.ENABLE_MANUS_MEMORY),
    ENABLE_MANUS_NOTIFICATIONS: parseBoolean(process.env.ENABLE_MANUS_NOTIFICATIONS),
    ENABLE_MANUS_AUTO_ACTIONS: parseBoolean(process.env.ENABLE_MANUS_AUTO_ACTIONS),
  };
}

export function isManusFeatureEnabled(flag: keyof ManusFeatureFlags): boolean {
  return getManusFeatureFlags()[flag];
}
