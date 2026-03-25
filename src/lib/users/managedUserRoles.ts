export const MANAGED_USER_ROLES = ["admin", "staff", "contractor", "manager"] as const;

export type ManagedUserRole = (typeof MANAGED_USER_ROLES)[number];

export const DEFAULT_MANAGED_USER_ROLE: ManagedUserRole = "staff";
