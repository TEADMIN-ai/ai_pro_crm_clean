"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useAuth } from "@/context/AuthContext";
import { canViewContractorList } from "@/lib/auth/roleUtils";
import { empireColors } from "@/theme/empireTheme";

export default function Sidebar() {
  const { role, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return null;
  }

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

      <div style={{ fontSize: 14, opacity: 0.7 }}>
        Role: {role}
      </div>

      <Link
        href="/dashboard"
        className={`empire-sidebar-link ${pathname === "/dashboard" ? "empire-sidebar-link-active" : ""}`}
        style={linkStyle(pathname === "/dashboard")}
      >
        Dashboard
      </Link>

      <Link
        href="/dashboard/deals"
        className={`empire-sidebar-link ${pathname.startsWith("/dashboard/deals") ? "empire-sidebar-link-active" : ""}`}
        style={linkStyle(pathname.startsWith("/dashboard/deals"))}
      >
        Deals
      </Link>

      {canViewContractorList(role) && (
        <Link
          href="/dashboard/contractors"
          className={`empire-sidebar-link ${pathname.startsWith("/dashboard/contractors") ? "empire-sidebar-link-active" : ""}`}
          style={linkStyle(pathname.startsWith("/dashboard/contractors"))}
        >
          Contractors
        </Link>
      )}

      {role === "admin" && (
        <Link
          href="/dashboard/executive"
          className={`empire-sidebar-link ${pathname.startsWith("/dashboard/executive") ? "empire-sidebar-link-active" : ""}`}
          style={linkStyle(pathname.startsWith("/dashboard/executive"))}
        >
          Executive
        </Link>
      )}

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
