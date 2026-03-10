import type { User as FirebaseUser } from "firebase/auth";
import type { UserRole } from "@/lib/auth/roleUtils";

export interface UserProfile {
  name?: string;
  email?: string;
  role: UserRole;
  status?: string;
  contractorId?: string;
  createdAt?: unknown;
}

export type AuthUser = FirebaseUser & UserProfile;

export const VALID_ROLES: UserRole[] = ["admin", "manager", "staff", "contractor", "guest"];

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== "string") {
    return "guest";
  }

  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : "guest";
}

export function normalizeContractorId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
