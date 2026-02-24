"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { canViewContractorList } from "@/lib/auth/roleUtils";

export default function Sidebar() {
  const { role, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#0f1c2e",
        color: "white",
        padding: "20px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2 style={{ marginBottom: 10 }}>Navigation</h2>

      <div style={{ fontSize: 14, opacity: 0.7 }}>
        Role: {role}
      </div>

      <Link href="/dashboard" style={linkStyle}>
        Dashboard
      </Link>

      <Link href="/dashboard/deals" style={linkStyle}>
        Deals
      </Link>

      {canViewContractorList(role) && (
        <Link href="/dashboard/contractors" style={linkStyle}>
          Contractors
        </Link>
      )}

    </aside>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "6px 0",
};
