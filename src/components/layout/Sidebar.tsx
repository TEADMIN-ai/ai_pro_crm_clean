"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import React from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const isActive = (path: string) =>
    pathname.startsWith(path) ? styles.activeLink : styles.link;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>Torque Empire</div>

      {/* ADMIN */}
      {user.role === "admin" && (
        <Link href="/dashboard/admin" style={isActive("/dashboard/admin")}>
          Admin
        </Link>
      )}

      {/* MANAGER */}
      {(user.role === "admin" || user.role === "manager") && (
        <Link href="/dashboard/manager" style={isActive("/dashboard/manager")}>
          Manager
        </Link>
      )}

      {/* STAFF */}
      {user.role === "staff" && (
        <Link href="/dashboard/staff" style={isActive("/dashboard/staff")}>
          Staff
        </Link>
      )}

      {/* DEALS (everyone) */}
      <Link href="/dashboard/deals" style={isActive("/dashboard/deals")}>
        Deals
      </Link>
    </aside>
  );
}

/* ---------------- STYLES ---------------- */

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #020617 0%, #020617 40%, #030a1a 100%)",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    borderRight: "1px solid rgba(255,255,255,0.08)",
  },

  brand: {
    fontSize: 18,
    fontWeight: 600,
    color: "#e5e7eb",
    marginBottom: 24,
    letterSpacing: 0.5,
  },

  link: {
    color: "#cbd5f5",
    textDecoration: "none",
    fontSize: 14,
    padding: "10px 12px",
    borderRadius: 8,
    transition: "background 0.2s ease",
  },

  activeLink: {
    color: "#ffffff",
    background: "rgba(99,102,241,0.15)",
    textDecoration: "none",
    fontSize: 14,
    padding: "10px 12px",
    borderRadius: 8,
  },
};