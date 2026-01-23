"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuthContext();

  const linkStyle = (path: string) => ({
    padding: "10px 14px",
    borderRadius: 10,
    marginBottom: 6,
    textDecoration: "none",
    color: "#e5e7eb",
    background:
      pathname === path ? "rgba(59,130,246,0.15)" : "transparent",
    fontWeight: pathname === path ? 600 : 400,
    display: "block",
  });

  return (
    <aside
      style={{
        width: 240,
        padding: 16,
        background: "rgba(15,23,42,0.8)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        minHeight: "100vh",
      }}
    >
      <nav>
        <Link href="/dashboard" style={linkStyle("/dashboard")}>
          Dashboard
        </Link>

        <Link href="/dashboard/deals" style={linkStyle("/dashboard/deals")}>
          Deals
        </Link>

        {/* ADMIN ONLY */}
        {role === "admin" && (
          <Link
            href="/dashboard/admin"
            style={linkStyle("/dashboard/admin")}
          >
            Admin
          </Link>
        )}

        {/* ADMIN + MANAGER */}
        {(role === "admin" || role === "manager") && (
          <Link
            href="/dashboard/manager"
            style={linkStyle("/dashboard/manager")}
          >
            Manager
          </Link>
        )}

        {/* STAFF */}
        {role === "staff" && (
          <Link
            href="/dashboard/staff"
            style={linkStyle("/dashboard/staff")}
          >
            Staff
          </Link>
        )}
      </nav>
    </aside>
  );
}