"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DealDetailPage() {
  return (
    <DashboardLayout>
      <div style={{ padding: "24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Deal Details</h1>
        <p style={{ opacity: 0.8, marginTop: 6 }}>
          Deal details and activity will appear here.
        </p>
      </div>
    </DashboardLayout>
  );
}