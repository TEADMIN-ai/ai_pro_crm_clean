export type UserRole = "admin" | "staff" | "contractor" | "manager";

export function getDashboardPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
      return "/dashboard/manager";
    case "contractor":
      return "/dashboard/staff";
    case "staff":
      return "/dashboard/staff";
    default:
      return "/login";
  }
}

