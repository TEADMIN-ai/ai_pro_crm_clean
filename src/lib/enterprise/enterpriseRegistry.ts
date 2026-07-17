import { isVehicleFinanceRole, type UserRole } from "@/lib/auth/roleUtils";
import type { WorkspaceType } from "@/lib/workspaces/workspaceTypes";

export type EnterpriseDivisionId =
  | "enterprise-core"
  | "vehicle-finance"
  | "operations"
  | "external"
  | "internal"
  | "development"
  | "contractor-portal";

export type EnterpriseDashboardGroup = "enterprise" | "vehicle-finance";
export type EnterpriseNavKey =
  | "overview"
  | "opportunityRegister"
  | "submissionProfiles"
  | "submissionReview"
  | "deals"
  | "contractors"
  | "qs"
  | "hygiene"
  | "vehicleFinance"
  | "inventory"
  | "listings"
  | "applications"
  | "customers"
  | "reports"
  | "tenderRequests"
  | "intelligence"
  | "governance"
  | "settings";

export interface EnterpriseDivisionRegistration {
  id: EnterpriseDivisionId;
  label: string;
  description: string;
  workspaceTypes: readonly WorkspaceType[];
  dashboardGroup: EnterpriseDashboardGroup;
  defaultDashboardPath: string;
}

export interface EnterpriseNavigationRegistration {
  id: EnterpriseNavKey;
  title: string;
  label: string;
  href: string;
  matchPaths: readonly string[];
  group: EnterpriseDashboardGroup;
  icon: EnterpriseNavKey;
  workspaceTypes: readonly WorkspaceType[];
  allowedRoles: readonly UserRole[] | null;
}

export interface EnterprisePermissionPolicy {
  viewRoles: readonly UserRole[];
  manageRoles: readonly UserRole[];
}

export const ENTERPRISE_ROUTE_PATHS = {
  login: "/login",
  dashboardRoot: "/dashboard",
  admin: "/dashboard/admin",
  manager: "/dashboard/manager",
  staff: "/dashboard/staff",
  contractor: "/dashboard/contractor",
  hygiene: "/dashboard/hygiene",
  hygieneJobs: "/dashboard/hygiene/jobs",
  vehicleFinance: "/dashboard/vehicle-finance",
  vehicleFinanceInventory: "/dashboard/vehicle-finance/inventory",
  vehicleFinanceListings: "/dashboard/vehicle-finance/listings",
  vehicleFinanceApplications: "/dashboard/vehicle-finance/applications",
  vehicleFinanceCustomers: "/dashboard/vehicle-finance/customers",
  vehicleFinanceReports: "/dashboard/vehicle-finance/reports",
  opportunityRegister: "/dashboard/opportunity-register",
  opportunityCentre: "/dashboard/opportunity-centre",
  submissionProfiles: "/dashboard/submission-profiles",
  submissionReview: "/dashboard/submission-review",
  deals: "/dashboard/deals",
  contractors: "/dashboard/contractors",
  qs: "/dashboard/qs",
  tenderPackRequests: "/dashboard/tender-pack-requests",
  intelligence: "/dashboard/intelligence",
  governance: "/dashboard/governance",
  settings: "/dashboard/settings",
  profile: "/dashboard/profile",
} as const;

const SHARED_AUTHENTICATED_DASHBOARD_PATHS = [
  ENTERPRISE_ROUTE_PATHS.settings,
  ENTERPRISE_ROUTE_PATHS.profile,
] as const;
const ENTERPRISE_DIVISIONS: readonly EnterpriseDivisionRegistration[] = [
  {
    id: "enterprise-core",
    label: "Enterprise Core",
    description: "Core Torque Empire workspace and command-center routes.",
    workspaceTypes: ["TORQUE_EMPIRE"],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.dashboardRoot,
  },
  {
    id: "vehicle-finance",
    label: "Vehicle Finance",
    description: "Roar Cars vehicle finance and dealership workflows.",
    workspaceTypes: ["ROAR_CARS"],
    dashboardGroup: "vehicle-finance",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.vehicleFinance,
  },
  {
    id: "operations",
    label: "Operations",
    description: "Hygiene and procurement execution workspaces.",
    workspaceTypes: ["HYGIENE", "PROCUREMENT"],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.dashboardRoot,
  },
  {
    id: "external",
    label: "External Collaboration",
    description: "Client and partner workspace registrations.",
    workspaceTypes: ["CLIENT", "PARTNER"],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.dashboardRoot,
  },
  {
    id: "internal",
    label: "Internal Services",
    description: "Internal and executive workspace registrations.",
    workspaceTypes: ["INTERNAL"],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.dashboardRoot,
  },
  {
    id: "development",
    label: "Development",
    description: "Developer and sandbox workspace registration.",
    workspaceTypes: ["DEVELOPMENT"],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.dashboardRoot,
  },
  {
    id: "contractor-portal",
    label: "Contractor Portal",
    description: "Contractor-facing submission and compliance workspace.",
    workspaceTypes: [],
    dashboardGroup: "enterprise",
    defaultDashboardPath: ENTERPRISE_ROUTE_PATHS.contractor,
  },
] as const;

const ENTERPRISE_NAVIGATION: readonly EnterpriseNavigationRegistration[] = [
  { id: "overview", title: "Overview", label: "Overview", href: ENTERPRISE_ROUTE_PATHS.dashboardRoot, matchPaths: [ENTERPRISE_ROUTE_PATHS.dashboardRoot], group: "enterprise", icon: "overview", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "opportunityRegister", title: "Opportunity Register", label: "Opportunity Register", href: ENTERPRISE_ROUTE_PATHS.opportunityRegister, matchPaths: [ENTERPRISE_ROUTE_PATHS.opportunityRegister, ENTERPRISE_ROUTE_PATHS.opportunityCentre], group: "enterprise", icon: "opportunityRegister", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "submissionProfiles", title: "Submission Profiles", label: "Submission Profiles", href: ENTERPRISE_ROUTE_PATHS.submissionProfiles, matchPaths: [ENTERPRISE_ROUTE_PATHS.submissionProfiles], group: "enterprise", icon: "submissionProfiles", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "submissionReview", title: "Submission Review", label: "Submission Review", href: ENTERPRISE_ROUTE_PATHS.submissionReview, matchPaths: [ENTERPRISE_ROUTE_PATHS.submissionReview], group: "enterprise", icon: "submissionReview", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "deals", title: "Deals", label: "Deals", href: ENTERPRISE_ROUTE_PATHS.deals, matchPaths: [ENTERPRISE_ROUTE_PATHS.deals], group: "enterprise", icon: "deals", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "contractors", title: "Contractors", label: "Contractors", href: ENTERPRISE_ROUTE_PATHS.contractors, matchPaths: [ENTERPRISE_ROUTE_PATHS.contractors], group: "enterprise", icon: "contractors", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "qs", title: "QS Engine", label: "QS Engine", href: ENTERPRISE_ROUTE_PATHS.qs, matchPaths: [ENTERPRISE_ROUTE_PATHS.qs], group: "enterprise", icon: "qs", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "hygiene", title: "Hygiene", label: "Hygiene", href: ENTERPRISE_ROUTE_PATHS.hygiene, matchPaths: [ENTERPRISE_ROUTE_PATHS.hygiene], group: "enterprise", icon: "hygiene", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "vehicleFinance", title: "Roar Cars SA", label: "Roar Cars SA", href: ENTERPRISE_ROUTE_PATHS.vehicleFinance, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinance], group: "vehicle-finance", icon: "vehicleFinance", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "inventory", title: "Inventory", label: "Inventory", href: ENTERPRISE_ROUTE_PATHS.vehicleFinanceInventory, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinanceInventory], group: "vehicle-finance", icon: "inventory", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "listings", title: "Listings", label: "Listings", href: ENTERPRISE_ROUTE_PATHS.vehicleFinanceListings, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinanceListings], group: "vehicle-finance", icon: "listings", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "applications", title: "Applications", label: "Applications", href: ENTERPRISE_ROUTE_PATHS.vehicleFinanceApplications, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinanceApplications], group: "vehicle-finance", icon: "applications", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "customers", title: "Customers", label: "Customers", href: ENTERPRISE_ROUTE_PATHS.vehicleFinanceCustomers, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinanceCustomers], group: "vehicle-finance", icon: "customers", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "reports", title: "Reports", label: "Reports", href: ENTERPRISE_ROUTE_PATHS.vehicleFinanceReports, matchPaths: [ENTERPRISE_ROUTE_PATHS.vehicleFinanceReports], group: "vehicle-finance", icon: "reports", workspaceTypes: ["ROAR_CARS"], allowedRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"] },
  { id: "tenderRequests", title: "Pack Requests", label: "Pack Requests", href: ENTERPRISE_ROUTE_PATHS.tenderPackRequests, matchPaths: [ENTERPRISE_ROUTE_PATHS.tenderPackRequests], group: "enterprise", icon: "tenderRequests", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "intelligence", title: "Intelligence", label: "Intelligence", href: ENTERPRISE_ROUTE_PATHS.intelligence, matchPaths: [ENTERPRISE_ROUTE_PATHS.intelligence], group: "enterprise", icon: "intelligence", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "governance", title: "Governance", label: "Governance", href: ENTERPRISE_ROUTE_PATHS.governance, matchPaths: [ENTERPRISE_ROUTE_PATHS.governance], group: "enterprise", icon: "governance", workspaceTypes: ["TORQUE_EMPIRE", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
  { id: "settings", title: "Settings", label: "Settings", href: ENTERPRISE_ROUTE_PATHS.settings, matchPaths: [ENTERPRISE_ROUTE_PATHS.settings], group: "enterprise", icon: "settings", workspaceTypes: ["TORQUE_EMPIRE", "ROAR_CARS", "HYGIENE", "PROCUREMENT", "CLIENT", "PARTNER", "INTERNAL", "DEVELOPMENT"], allowedRoles: null },
] as const;

export function getEnterpriseNavigationRegistry(): EnterpriseNavigationRegistration[] {
  return ENTERPRISE_NAVIGATION.map((item) => ({
    ...item,
    matchPaths: [...item.matchPaths],
    workspaceTypes: [...item.workspaceTypes],
    allowedRoles: item.allowedRoles ? [...item.allowedRoles] : null,
  }));
}
export function getEnterpriseWorkspaceDivisionId(type: WorkspaceType): EnterpriseDivisionId {
  switch (type) {
    case "ROAR_CARS":
      return "vehicle-finance";
    case "HYGIENE":
    case "PROCUREMENT":
      return "operations";
    case "CLIENT":
    case "PARTNER":
      return "external";
    case "INTERNAL":
      return "internal";
    case "DEVELOPMENT":
      return "development";
    case "TORQUE_EMPIRE":
    default:
      return "enterprise-core";
  }
}

export function getEnterpriseDashboardGroupForRole(role: UserRole): EnterpriseDashboardGroup {
  return isVehicleFinanceRole(role) ? "vehicle-finance" : "enterprise";
}

export function getEnterpriseDashboardPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return ENTERPRISE_ROUTE_PATHS.admin;
    case "manager":
      return ENTERPRISE_ROUTE_PATHS.manager;
    case "dealerPilot":
    case "vehicleFinanceStaff":
    case "ROAR_CARS_STAFF":
      return ENTERPRISE_ROUTE_PATHS.vehicleFinance;
    case "contractor":
      return ENTERPRISE_ROUTE_PATHS.contractor;
    case "driver":
      return ENTERPRISE_ROUTE_PATHS.hygieneJobs;
    case "staff":
      return ENTERPRISE_ROUTE_PATHS.staff;
    default:
      return ENTERPRISE_ROUTE_PATHS.login;
  }
}

export function getEnterpriseUnauthorizedRedirectPath(role: UserRole): string {
  return role === "guest" ? ENTERPRISE_ROUTE_PATHS.login : getEnterpriseDashboardPath(role);
}

export function getEnterpriseNavigationForRole(role: UserRole): EnterpriseNavigationRegistration[] {
  const group = getEnterpriseDashboardGroupForRole(role);
  return getEnterpriseNavigationRegistry().filter((item) => item.group === group);
}

function matchesPath(pathname: string, matchPaths: readonly string[]): boolean {
  return matchPaths.some((matchPath) => pathname === matchPath || pathname.startsWith(`${matchPath}/`));
}

export function getEnterpriseNavigationByPath(pathname: string): EnterpriseNavigationRegistration | null {
  return getEnterpriseNavigationRegistry()
    .sort((left, right) => Math.max(...right.matchPaths.map((path) => path.length)) - Math.max(...left.matchPaths.map((path) => path.length)))
    .find((item) => matchesPath(pathname, item.matchPaths)) ?? null;
}
export function isRoarCarsDashboardPath(pathname: string): boolean {
  if (matchesPath(pathname, SHARED_AUTHENTICATED_DASHBOARD_PATHS)) {
    return true;
  }

  const navigation = getEnterpriseNavigationByPath(pathname);
  if (navigation?.href === ENTERPRISE_ROUTE_PATHS.vehicleFinance && pathname !== ENTERPRISE_ROUTE_PATHS.vehicleFinance) {
    return false;
  }

  return navigation?.group === "vehicle-finance";
}

export function isHygieneDriverDashboardPath(pathname: string): boolean {
  return matchesPath(pathname, [ENTERPRISE_ROUTE_PATHS.hygieneJobs, "/dashboard/hygiene/vehicles", "/dashboard/hygiene/signatures", "/dashboard/hygiene/disposal"]);
}

export function getEnterprisePermissionPolicyByType(type: WorkspaceType): EnterprisePermissionPolicy {
  switch (type) {
    case "ROAR_CARS":
      return {
        viewRoles: ["admin", "manager", "staff", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"],
        manageRoles: ["admin", "manager", "dealerPilot", "vehicleFinanceStaff", "ROAR_CARS_STAFF"],
      };
    case "HYGIENE":
      return {
        viewRoles: ["admin", "manager", "staff", "driver"],
        manageRoles: ["admin", "manager"],
      };
    case "PROCUREMENT":
    case "TORQUE_EMPIRE":
    case "CLIENT":
    case "PARTNER":
    case "INTERNAL":
    case "DEVELOPMENT":
    default:
      return {
        viewRoles: ["admin", "manager", "staff"],
        manageRoles: ["admin", "manager"],
      };
  }
}



