"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const linkStyle = (active: boolean): React.CSSProperties => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  color: active ? "#ffffff" : "rgba(255,255,255,0.82)",
  background: active ? "rgba(37,99,235,0.30)" : "transparent",
  textDecoration: "none",
  fontWeight: 600,
});

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Firebase User does not include role, so read it safely.
  const role = (user as any)?.role as "admin" | "manager" | "staff" | undefined;

  return (
    <aside
      style={{
        width: 240,
        padding: 16,
        borderRight: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(15, 23, 42, 0.35)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ color: "#fff", fontWeight: 800, marginBottom: 14 }}>
        Torque Empire
      </div>

      <nav style={{ display: "grid", gap: 8 }}>
        <Link href="/dashboard" style={linkStyle(pathname === "/dashboard")}>
          Dashboard
        </Link>

        <Link
          href="/dashboard/deals"
          style={linkStyle(pathname?.startsWith("/dashboard/deals") ?? false)}
        >
          Deals
        </Link>

        {/* Only show these if role is known */}
        {role === "staff" && (
          <Link
            href="/dashboard/staff"
            style={linkStyle(pathname?.startsWith("/dashboard/staff") ?? false)}
          >
            Staff
          </Link>
        )}

        {(role === "manager" || role === "admin") && (
          <Link
            href="/dashboard/manager"
            style={linkStyle(pathname?.startsWith("/dashboard/manager") ?? false)}
          >
            Manager
          </Link>
        )}

        {role === "admin" && (
          <>
            <Link
              href="/dashboard/admin"
              style={linkStyle(pathname?.startsWith("/dashboard/admin") ?? false)}
            >
              Admin
            </Link>
            <Link
              href="/dashboard/users"
              style={linkStyle(pathname?.startsWith("/dashboard/users") ?? false)}
            >
              Users
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}