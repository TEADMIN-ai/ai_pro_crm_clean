"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useAuth } from "@/context/AuthContext";
import { canViewContractorList, isVehicleFinanceRole } from "@/lib/auth/roleUtils";
import { empireColors } from "@/theme/empireTheme";

export default function Sidebar() {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    console.info("[Sidebar] Auth state loading. Rendering sidebar placeholder");
    return (
      <aside
        style={{
          width: 220,
          minHeight: "100vh",
          background: empireColors.surface,
          color: empireColors.textPrimary,
          padding: "24px 16px",
          borderRight: `1px solid ${empireColors.border}`,
        }}
      >
        Loading navigation...
      </aside>
    );
  }

  const contractorLinks =
    role === "contractor" && user?.contractorId
      ? [
          {
            href: "/dashboard",
            label: "Compliance Status",
            active: pathname === "/dashboard",
          },
          {
            href: "/dashboard/deals",
            label: "Tender Submissions",
            active: pathname.startsWith("/dashboard/deals"),
          },
          {
            href: `/dashboard/contractors/${encodeURIComponent(user.contractorId)}`,
            label: "My Documents",
            active: pathname.startsWith("/dashboard/contractors"),
          },
        ]
      : [];

  const vehicleFinanceLinks =
    isVehicleFinanceRole(role) || role === "admin" || role === "manager" || role === "staff"
      ? [
          {
            href: "/dashboard/vehicle-finance",
            label: "Roar Cars Dashboard",
            active: pathname === "/dashboard/vehicle-finance",
          },
          {
            href: "/dashboard/vehicle-finance/listings",
            label: "Vehicle Listings",
            active: pathname.startsWith("/dashboard/vehicle-finance/listings"),
          },
          {
            href: "/dashboard/vehicle-finance/inventory",
            label: "Vehicle Inventory",
            active: pathname.startsWith("/dashboard/vehicle-finance/inventory"),
          },
          {
            href: "/dashboard/vehicle-finance/customers",
            label: "Customer Enquiries",
            active: pathname.startsWith("/dashboard/vehicle-finance/customers"),
          },
          {
            href: "/dashboard/vehicle-finance/applications",
            label: "Finance Applications",
            active: pathname.startsWith("/dashboard/vehicle-finance/applications"),
          },
          {
            href: "/dashboard/vehicle-finance/document-verification",
            label: "Verification",
            active: pathname.startsWith("/dashboard/vehicle-finance/document-verification"),
          },
          {
            href: "/dashboard/vehicle-finance/reports",
            label: "Reports",
            active: pathname.startsWith("/dashboard/vehicle-finance/reports"),
          },
        ]
      : [];

  const internalLinks =
    role !== "contractor"
      ? isVehicleFinanceRole(role)
        ? vehicleFinanceLinks
        : [
            {
              href: "/dashboard",
              label: "Dashboard",
              active: pathname === "/dashboard",
            },
            {
              href: "/dashboard/deals",
              label: "Deals",
              active: pathname.startsWith("/dashboard/deals"),
            },
            ...(canViewContractorList(role)
              ? [
                  {
                    href: "/dashboard/contractors",
                    label: "Contractors",
                    active: pathname.startsWith("/dashboard/contractors"),
                  },
                ]
              : []),
            {
              href: "/dashboard/vehicle-finance",
              label: "Roar Cars SA",
              active: pathname.startsWith("/dashboard/vehicle-finance"),
            },
            ...(role === "admin"
              ? [
                  {
                    href: "/dashboard/executive",
                    label: "Executive",
                    active: pathname.startsWith("/dashboard/executive"),
                  },
                ]
              : []),
          ]
      : [];

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: empireColors.surface,
        color: empireColors.textPrimary,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderRight: `1px solid ${empireColors.border}`,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        position: "sticky",
        top: 0,
      }}
    >
      <h2 style={{ marginBottom: 8, fontSize: 20 }}>Workspace</h2>

      <div style={{ fontSize: 14, color: empireColors.textSecondary }}>Role: {role}</div>

      {contractorLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`empire-sidebar-link ${item.active ? "empire-sidebar-link-active" : ""}`}
          style={linkStyle(item.active)}
        >
          {item.label}
        </Link>
      ))}

      {internalLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`empire-sidebar-link ${item.active ? "empire-sidebar-link-active" : ""}`}
          style={linkStyle(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </aside>
  );
}

const linkStyle = (active: boolean): CSSProperties => ({
  color: active ? "#2563EB" : empireColors.textSecondary,
  textDecoration: "none",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${active ? "#DBEAFE" : "transparent"}`,
  background: active ? "#EFF6FF" : "transparent",
  boxShadow: "none",
  fontWeight: active ? 600 : 500,
  transition: "all 0.25s ease",
});
