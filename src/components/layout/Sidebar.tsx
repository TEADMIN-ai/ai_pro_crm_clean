"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useAuth } from "@/context/AuthContext";
import { canViewContractorList } from "@/lib/auth/roleUtils";
import { empireColors } from "@/theme/empireTheme";

export default function Sidebar() {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return null;
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

  const internalLinks =
    role !== "contractor"
      ? [
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
