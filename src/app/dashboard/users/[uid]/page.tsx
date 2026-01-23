"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function UserProfilePage() {
  return (
    <DashboardLayout>
      <div style={{ padding: "24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>User Profile</h1>
        <p style={{ opacity: 0.8, marginTop: 6 }}>
          User details and permissions will be shown here.
        </p>
      </div>
    </DashboardLayout>
  );
}