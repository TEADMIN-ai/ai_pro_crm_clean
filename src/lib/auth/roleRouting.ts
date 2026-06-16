import type { UserRole } from "@/lib/auth/roleUtils";

export function getDashboardPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
      return "/dashboard/manager";
    case "dealerPilot":
    case "vehicleFinanceStaff":
      return "/dashboard/vehicle-finance";
    case "contractor":
      return "/dashboard/contractor";
    case "staff":
      return "/dashboard/staff";
    default:
      return "/login";
  }
}

export function getUnauthorizedRedirectPath(role: UserRole): string {
  return role === "guest" ? "/login" : getDashboardPath(role);
}
