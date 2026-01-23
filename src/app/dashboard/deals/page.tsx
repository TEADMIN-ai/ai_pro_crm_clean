"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DealsPage() {
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
          Deals
        </h1>

        <p style={{ marginTop: 8, opacity: 0.8 }}>
          View and manage all deals
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          No deals found.
        </div>
      </div>
    </DashboardLayout>
  );
}
