import type { UserRole } from "@/lib/auth/roleUtils";

const ROAR_CARS_MODULE_PATHS = [
  "/dashboard/vehicle-finance/inventory",
  "/dashboard/vehicle-finance/listings",
  "/dashboard/vehicle-finance/applications",
  "/dashboard/vehicle-finance/customers",
  "/dashboard/vehicle-finance/reports",
  "/dashboard/settings",
  "/dashboard/profile",
] as const;

export function isRoarCarsDashboardPath(pathname: string): boolean {
  if (pathname === "/dashboard/vehicle-finance" || pathname === "/dashboard/vehicle-finance/") {
    return true;
  }

  return ROAR_CARS_MODULE_PATHS.some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

export function getDashboardPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "manager":
      return "/dashboard/manager";
    case "dealerPilot":
    case "vehicleFinanceStaff":
    case "ROAR_CARS_STAFF":
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
