"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Sidebar from "@/components/layout/Sidebar";
import type { UserRole } from "@/types/auth";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { loading, role } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          opacity: 0.85,
        }}
      >
        Loading dashboard…
      </div>
    );
  }

  if (!role) {
    return <div style={{ padding: 20 }}>Role not loaded</div>;
  }

  const userRole: UserRole = role;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background:
          "linear-gradient(135deg, #dbeafe 0%, #93c5fd 50%, #64748b 100%)",
      }}
    >
      <Sidebar role={userRole} />

      <div style={{ flex: 1 }}>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <DashboardHeader />
        </div>

        <main style={{ padding: "0 24px 40px" }}>{children}</main>
      </div>
    </div>
  );
}
