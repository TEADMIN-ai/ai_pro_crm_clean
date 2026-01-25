"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function DashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#fff" }}>
        Loading dashboard...
      </div>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ✅ FIX: role is now passed */}
      <Sidebar role={role} />

      <div style={{ flex: 1 }}>
        <DashboardHeader />
        {children}
      </div>
    </div>
  );
}