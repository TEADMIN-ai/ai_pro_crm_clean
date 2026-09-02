"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isVehicleFinancePartnerRole, isVehicleFinanceRole } from "@/lib/auth/roleUtils";

type GovernanceNavBadge = {
  label: string;
  count: number;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "CLEAR";
};

type DashboardNavItem = {
  key: "overview" | "masterDataReview" | "opportunityRegister" | "submissionProfiles" | "submissionReview" | "deals" | "contractors" | "qs" | "hygiene" | "vehicleFinance" | "inventory" | "listings" | "applications" | "customers" | "reports" | "partnerPortal" | "tenderRequests" | "intelligence" | "governance" | "settings";
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    key: "opportunityRegister",
    href: "/dashboard/opportunity-register",
    label: "Opportunity Register",
    match: (pathname) => pathname.startsWith("/dashboard/opportunity-register") || pathname.startsWith("/dashboard/opportunity-centre"),
  },
  {
    key: "submissionProfiles",
    href: "/dashboard/submission-profiles",
    label: "Submission Profiles",
    match: (pathname) => pathname.startsWith("/dashboard/submission-profiles"),
  },
  {
    key: "submissionReview",
    href: "/dashboard/submission-review",
    label: "Submission Review",
    match: (pathname) => pathname.startsWith("/dashboard/submission-review"),
  },
  {
    key: "overview",
    href: "/dashboard",
    label: "Overview",
    match: (pathname) => pathname === "/dashboard",
  },
  {
    key: "deals",
    href: "/dashboard/deals",
    label: "Deals",
    match: (pathname) => pathname.startsWith("/dashboard/deals"),
  },
  {
    key: "contractors",
    href: "/dashboard/contractors",
    label: "Contractors",
    match: (pathname) => pathname.startsWith("/dashboard/contractors"),
  },
  {
    key: "qs",
    href: "/dashboard/qs",
    label: "QS Engine",
    match: (pathname) => pathname.startsWith("/dashboard/qs"),
  },
  {
    key: "hygiene",
    href: "/dashboard/hygiene",
    label: "Hygiene",
    match: (pathname) => pathname.startsWith("/dashboard/hygiene"),
  },
  {
    key: "vehicleFinance",
    href: "/dashboard/vehicle-finance",
    label: "Torque Empire Car Division",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance"),
  },
  {
    key: "tenderRequests",
    href: "/dashboard/tender-pack-requests",
    label: "Pack Requests",
    match: (pathname) => pathname.startsWith("/dashboard/tender-pack-requests"),
  },
  {
    key: "intelligence",
    href: "/dashboard/intelligence",
    label: "Intelligence",
    match: (pathname) => pathname.startsWith("/dashboard/intelligence"),
  },
  {
    key: "masterDataReview",
    href: "/dashboard/master-data-review",
    label: "Master Data",
    match: (pathname) => pathname.startsWith("/dashboard/master-data-review"),
  },
  {
    key: "governance",
    href: "/dashboard/governance",
    label: "Governance",
    match: (pathname) => pathname.startsWith("/dashboard/governance"),
  },
  {
    key: "settings",
    href: "/dashboard/settings",
    label: "Settings",
    match: (pathname) => pathname.startsWith("/dashboard/settings"),
  },
];

const VEHICLE_FINANCE_PARTNER_NAV_ITEMS: DashboardNavItem[] = [
  {
    key: "partnerPortal",
    href: "/dashboard/vehicle-finance/partner",
    label: "Partner Portal",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/partner"),
  },
];

const ROAR_CARS_NAV_ITEMS: DashboardNavItem[] = [
  {
    key: "vehicleFinance",
    href: "/dashboard/vehicle-finance",
    label: "Dashboard",
    match: (pathname) => pathname === "/dashboard/vehicle-finance",
  },
  {
    key: "inventory",
    href: "/dashboard/vehicle-finance/inventory",
    label: "Inventory",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/inventory"),
  },
  {
    key: "listings",
    href: "/dashboard/vehicle-finance/listings",
    label: "Listings",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/listings"),
  },
  {
    key: "applications",
    href: "/dashboard/vehicle-finance/applications",
    label: "Applications",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/applications"),
  },
  {
    key: "customers",
    href: "/dashboard/vehicle-finance/customers",
    label: "Customers",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/customers"),
  },
  {
    key: "reports",
    href: "/dashboard/vehicle-finance/reports",
    label: "Reports",
    match: (pathname) => pathname.startsWith("/dashboard/vehicle-finance/reports"),
  },
  {
    key: "settings",
    href: "/dashboard/settings",
    label: "Settings",
    match: (pathname) => pathname.startsWith("/dashboard/settings"),
  },
];

function DashboardNavIcon({ itemKey, active }: { itemKey: DashboardNavItem["key"]; active: boolean }) {
  const iconClassName = active ? "text-[color:var(--tex-text-strong)]" : "text-[color:var(--tex-text-muted)] group-hover:text-[color:var(--tex-text-strong)]";

  switch (itemKey) {
    case "opportunityRegister":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M5 4.5h10v11H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "submissionProfiles":
    case "submissionReview":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M5 4.5h6.5L15 8v7.5H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11.5 4.5V8H15M7 10.25h6M7 12.75h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "deals":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M4.5 5.5h11v9h-11z" stroke="currentColor" strokeWidth="1.5" rx="2" />
          <path d="M7 8.5h6M7 11.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "contractors":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M10 10a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 15.5a4.5 4.5 0 019 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "qs":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M5 4.5h10v11h-10z" stroke="currentColor" strokeWidth="1.5" rx="1.5" />
          <path d="M7.25 7.25h5.5M7.25 10h5.5M7.25 12.75h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "partnerPortal":
    case "vehicleFinance":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M4.5 11.5h11l-1-4h-9l-1 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6.25 11.5v2.25m7.5-2.25v2.25M5.5 15.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "hygiene":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M6 4.5h8l1 3.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 15V8l1-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.5 8h5M8.25 11h3.5M8.25 13.5h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "masterDataReview":
    case "governance":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M10 3.5l5.5 2.25v3.5c0 3.3-2.14 6.27-5.5 7.25-3.36-.98-5.5-3.95-5.5-7.25v-3.5L10 3.5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.75 9.75L9.25 11.25 12.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "tenderRequests":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M5 4.5h7.5L15 7v8.5h-10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12.5 4.5V7H15M7.5 10h5M7.5 13h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "intelligence":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M4.5 15.5v-7M8.2 15.5v-11M11.8 15.5v-5M15.5 15.5v-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3.5 15.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 10a6 6 0 00-.08-.96l1.36-1.06-1.5-2.6-1.64.55a6.07 6.07 0 00-1.66-.96L12.2 3h-2.4l-.28 1.97c-.6.2-1.15.52-1.66.96l-1.64-.55-1.5 2.6 1.36 1.06A6 6 0 004 10c0 .33.03.65.08.96L2.72 12.02l1.5 2.6 1.64-.55c.5.44 1.06.76 1.66.96l.28 1.97h2.4l.28-1.97c.6-.2 1.15-.52 1.66-.96l1.64.55 1.5-2.6-1.36-1.06c.05-.31.08-.63.08-.96z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case "overview":
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" className={"h-4 w-4 " + iconClassName} aria-hidden="true">
          <path d="M4.5 10.5L8 7l2.25 2.25L15.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 5.5v9h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function getBadgeClasses(severity: GovernanceNavBadge["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return "border-rose-300/45 bg-rose-500/20 text-rose-50";
    case "HIGH":
      return "border-orange-300/45 bg-orange-500/20 text-orange-50";
    case "MODERATE":
      return "border-amber-300/45 bg-amber-500/20 text-amber-50";
    case "LOW":
      return "border-sky-300/45 bg-sky-500/20 text-sky-50";
    case "CLEAR":
    default:
      return "border-emerald-300/45 bg-emerald-500/20 text-emerald-50";
  }
}

function renderBadge(badge: GovernanceNavBadge, compact = false) {
  const compactLabel = badge.count > 0 ? badge.label + " " + badge.count : badge.label;

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] " + getBadgeClasses(badge.severity)}>
      {compact ? compactLabel : badge.label + (badge.count > 0 ? " " + badge.count : "")}
    </span>
  );
}

export default function DashboardWorkspaceNav({
  governanceBadge,
  mode = "sidebar",
}: {
  governanceBadge: GovernanceNavBadge;
  mode?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const { role, loading } = useAuth();
  const navItems = isVehicleFinancePartnerRole(role) ? VEHICLE_FINANCE_PARTNER_NAV_ITEMS : isVehicleFinanceRole(role) ? ROAR_CARS_NAV_ITEMS : DASHBOARD_NAV_ITEMS;

  if (loading) {
    return (
      <nav
        aria-label="Loading workspace navigation"
        aria-busy="true"
        className={mode === "mobile" ? "h-10 md:hidden" : "flex-1 px-4 py-6"}
      />
    );
  }

  return (
    <>
      <nav className={mode === "mobile" ? "hidden" : "flex-1 space-y-2 px-4 py-6"}>
        {navItems.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="tex-workspace-nav-item group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-[color:var(--tex-text-muted)] transition-all duration-200 hover:translate-x-0.5 hover:border-[color:var(--tex-nav-active-border)] hover:bg-[color:var(--tex-nav-hover-bg)] hover:text-[color:var(--tex-text-strong)] aria-[current=page]:border-[color:var(--tex-nav-active-border)] aria-[current=page]:bg-[color:var(--tex-nav-active-bg)] aria-[current=page]:text-[color:var(--tex-text-strong)] aria-[current=page]:shadow-[0_14px_34px_rgba(37,99,235,0.13)]"
            >
              <span className="flex items-center gap-3">
                <span className="tex-workspace-nav-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-white/60 transition-all duration-200 group-hover:border-[color:var(--tex-nav-active-border)] group-hover:bg-[color:var(--tex-nav-active-bg)] group-aria-[current=page]:border-[color:var(--tex-nav-active-border)] group-aria-[current=page]:bg-[color:var(--tex-nav-active-bg)] [&_svg]:block [&_svg]:shrink-0">
                  <DashboardNavIcon itemKey={item.key} active={active} />
                </span>
                <span className="tracking-[0.01em]">{item.label}</span>
              </span>

              {item.key === "governance" ? renderBadge(governanceBadge, true) : null}
            </Link>
          );
        })}
      </nav>

      <div className={mode === "sidebar" ? "hidden" : "flex gap-2 overflow-x-auto pb-1 pr-1 md:hidden"}>
        {navItems.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="tex-workspace-nav-item group inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold text-[color:var(--tex-text-muted)] transition-all duration-200 hover:border-[color:var(--tex-nav-active-border)] hover:bg-[color:var(--tex-nav-hover-bg)] hover:text-[color:var(--tex-text-strong)] aria-[current=page]:border-[color:var(--tex-nav-active-border)] aria-[current=page]:bg-[color:var(--tex-nav-active-bg)] aria-[current=page]:text-[color:var(--tex-text-strong)]"
            >
              <DashboardNavIcon itemKey={item.key} active={active} />
              <span>{item.label}</span>
              {item.key === "governance" ? renderBadge(governanceBadge, true) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}

export type { GovernanceNavBadge };


