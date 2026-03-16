import type { UserRole } from "@/lib/auth/roleUtils";

export function canViewAuditRole(role: UserRole): boolean {
  return role === "admin" || role === "auditor" || role === "viewer";
}

export function canEditAuditRole(role: UserRole): boolean {
  return role === "admin" || role === "auditor";
}
