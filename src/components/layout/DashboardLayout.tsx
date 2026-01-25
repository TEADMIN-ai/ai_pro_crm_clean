"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role, loading } = useAuth();

  if (loading || !role) {
    return <div style={{ padding: 40 }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar role={role} />

      <div style={{ flex: 1 }}>
        <DashboardHeader />
        {children}
      </div>
    </div>
  );
}