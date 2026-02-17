"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { logout } = useAuth();

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          padding: "24px",
          background: "linear-gradient(135deg,#8fb1d6,#6a8db8)",
          minHeight: "100vh",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={logout}
            style={{
              background: "#2e5bd7",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
