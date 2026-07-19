import type { UserRole } from "@/lib/auth/roleUtils";
import {
  ENTERPRISE_ROUTE_PATHS,
  getEnterpriseDashboardPath,
  getEnterpriseUnauthorizedRedirectPath,
  isHygieneDriverDashboardPath,
  isRoarCarsDashboardPath,
} from "@/lib/enterprise/enterpriseRegistry";

export { isRoarCarsDashboardPath, isHygieneDriverDashboardPath };

export function getDashboardPath(role: UserRole) {
  return getEnterpriseDashboardPath(role);
}

export function getUnauthorizedRedirectPath(role: UserRole): string {
  return getEnterpriseUnauthorizedRedirectPath(role);
}

export const DASHBOARD_STARTUP_PATHS = ENTERPRISE_ROUTE_PATHS;
