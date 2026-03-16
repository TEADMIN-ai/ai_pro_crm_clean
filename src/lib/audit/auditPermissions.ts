import { canEditAuditRole, canViewAuditRole } from "@/lib/audit/auditRoleRules";
import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";

export function canViewAuditModule(user: AuthorizedUser): boolean {
  return canViewAuditRole(user.role);
}

export function canEditAuditModule(user: AuthorizedUser): boolean {
  return canEditAuditRole(user.role);
}

export function assertCanViewAuditModule(user: AuthorizedUser): void {
  if (!canViewAuditModule(user)) {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export function assertCanEditAuditModule(user: AuthorizedUser): void {
  if (!canEditAuditModule(user)) {
    throw new AuthorizationError("unauthorized", 403);
  }
}
