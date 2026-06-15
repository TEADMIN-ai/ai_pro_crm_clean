"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type GovernanceNavBadge = {
  label: string;
  count: number;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "CLEAR";
};

type DashboardNavItem = {
  key: "overview" | "deals" | "contractors" | "vehicleFinance" | "tenderRequests" | "intelligence" | "governance" | "settings";
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
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
    key: "vehicleFinance",
    href: "/dashboard/vehicle-finance",
    label: "Vehicle Finance",
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

function DashboardNavIcon({ itemKey, active }: { itemKey: DashboardNavItem["key"]; active: boolean }) {
  const iconClassName = active ? "text-cyan-100" : "text-slate-500 group-hover:text-slate-200";

  switch (itemKey) {
    case "deals":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M4.5 5.5h11v9h-11z" stroke="currentColor" strokeWidth="1.5" rx="2" />
          <path d="M7 8.5h6M7 11.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "contractors":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M10 10a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 15.5a4.5 4.5 0 019 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "vehicleFinance":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M4.5 11.5h11l-1-4h-9l-1 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6.25 11.5v2.25m7.5-2.25v2.25M5.5 15.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "governance":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M10 3.5l5.5 2.25v3.5c0 3.3-2.14 6.27-5.5 7.25-3.36-.98-5.5-3.95-5.5-7.25v-3.5L10 3.5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.75 9.75L9.25 11.25 12.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "tenderRequests":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M5 4.5h7.5L15 7v8.5h-10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12.5 4.5V7H15M7.5 10h5M7.5 13h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "intelligence":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M4.5 15.5v-7M8.2 15.5v-11M11.8 15.5v-5M15.5 15.5v-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3.5 15.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 10a6 6 0 00-.08-.96l1.36-1.06-1.5-2.6-1.64.55a6.07 6.07 0 00-1.66-.96L12.2 3h-2.4l-.28 1.97c-.6.2-1.15.52-1.66.96l-1.64-.55-1.5 2.6 1.36 1.06A6 6 0 004 10c0 .33.03.65.08.96L2.72 12.02l1.5 2.6 1.64-.55c.5.44 1.06.76 1.66.96l.28 1.97h2.4l.28-1.97c.6-.2 1.15-.52 1.66-.96l1.64.55 1.5-2.6-1.36-1.06c.05-.31.08-.63.08-.96z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case "overview":
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${iconClassName}`} aria-hidden="true">
          <path d="M4.5 10.5L8 7l2.25 2.25L15.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 5.5v9h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function getBadgeClasses(severity: GovernanceNavBadge["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return "border-rose-400/30 bg-rose-500/15 text-rose-100";
    case "HIGH":
      return "border-orange-400/30 bg-orange-500/15 text-orange-100";
    case "MODERATE":
      return "border-amber-400/30 bg-amber-500/15 text-amber-100";
    case "LOW":
      return "border-sky-400/30 bg-sky-500/15 text-sky-100";
    case "CLEAR":
    default:
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
  }
}

function renderBadge(badge: GovernanceNavBadge, compact = false) {
  const compactLabel = badge.count > 0 ? `${badge.label} ${badge.count}` : badge.label;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getBadgeClasses(badge.severity)}`}
    >
      {compact ? compactLabel : `${badge.label}${badge.count > 0 ? ` ${badge.count}` : ""}`}
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

  return (
    <>
      <nav className={`${mode === "mobile" ? "hidden" : "flex-1 space-y-2 px-4 py-6"}`}>
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                active
                  ? item.key === "governance"
                    ? "border-teal-400/30 bg-teal-400/12 text-white shadow-[0_12px_28px_rgba(20,184,166,0.14)]"
                    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100 shadow-[0_12px_28px_rgba(8,145,178,0.12)]"
                  : item.key === "governance"
                    ? "border-transparent text-slate-300 hover:border-teal-400/20 hover:bg-teal-400/10 hover:text-white"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${
                  active
                    ? item.key === "governance"
                      ? "border-teal-300/30 bg-teal-300/10"
                      : "border-cyan-300/30 bg-cyan-300/10"
                    : item.key === "governance"
                      ? "border-teal-400/15 bg-teal-400/5"
                      : "border-white/10 bg-white/[0.03]"
                }`}>
                  <DashboardNavIcon itemKey={item.key} active={active} />
                </span>
                <span className="tracking-[0.01em]">{item.label}</span>
              </span>

              {item.key === "governance" ? renderBadge(governanceBadge, true) : null}
            </Link>
          );
        })}
      </nav>

      <div className={`${mode === "sidebar" ? "hidden" : "flex gap-2 overflow-x-auto pb-1 pr-1 md:hidden"}`}>
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium ${
                active
                  ? item.key === "governance"
                    ? "border-teal-400/25 bg-teal-400/12 text-teal-100"
                    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
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
