"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DashboardHomePage() {
  return (
    <DashboardLayout>
      <div style={{ padding: "24px" }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#ffffff",
            textShadow: "0 2px 6px rgba(0,0,0,0.35)",
          }}
        >
          Dashboard
        </h1>

        <p
          style={{
            marginTop: 8,
            opacity: 0.8,
            color: "#e5e7eb",
          }}
        >
          Select a section from the menu to continue.
        </p>
      </div>
    </DashboardLayout>
  );
}