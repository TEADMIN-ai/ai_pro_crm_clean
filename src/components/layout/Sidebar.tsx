"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const { role } = useAuth();

  return (
    <aside
      style={{
        width: 240,
        background: "#0b1a33",
        color: "white",
        padding: "24px 16px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Navigation</h2>

      <div style={{ fontSize: 14, opacity: 0.8 }}>
        Role: {role ?? "guest"}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link
          href="/dashboard"
          style={{ color: "white", textDecoration: "none" }}
        >
          Dashboard
        </Link>

        <Link
          href="/dashboard/deals"
          style={{ color: "white", textDecoration: "none" }}
        >
          Deals
        </Link>

        {/* Admin-only example link */}
        {role === "admin" && (
          <Link
            href="/dashboard/deals/new"
            style={{ color: "white", textDecoration: "none" }}
          >
            Create Deal
          </Link>
        )}
      </nav>

      <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.6 }}>
        Torque Empire CRM
      </div>
    </aside>
  );
}
