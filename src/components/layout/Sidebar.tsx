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
        padding: "20px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderRight: `1px solid ${empireColors.border}`,
        boxShadow: "inset -1px 0 0 rgba(0,240,255,0.08)",
        position: "sticky",
        top: 0,
      }}
    >
      <h2 style={{ marginBottom: 10 }}>Navigation</h2>

      <div style={{ fontSize: 14, opacity: 0.7 }}>Role: {role}</div>

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
  color: active ? empireColors.textPrimary : empireColors.textSecondary,
  textDecoration: "none",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${active ? "rgba(0,240,255,0.4)" : "transparent"}`,
  background: active ? "rgba(0,240,255,0.08)" : "transparent",
  boxShadow: active ? empireColors.primaryGlow : "none",
  transition: "all 0.25s ease",
});
