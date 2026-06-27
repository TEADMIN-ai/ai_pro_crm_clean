import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";

export function assertQsInternalAccess(user: AuthorizedUser) {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
    throw new AuthorizationError("unauthorized", 403);
  }
}
