export type UserRole = "admin" | "manager" | "staff";

export function getDashboardPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
      return "/dashboard/manager";
    case "staff":
      return "/dashboard/staff";
    default:
      return "/login";
  }
}

