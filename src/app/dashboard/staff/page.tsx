"use client";

import RequireRole from "@/components/auth/RequireRole";

export default function StaffDashboard() {
  return (
    <RequireRole allow={["staff", "manager", "admin"]}>
      <h1>Staff Dashboard</h1>
      <p>Your assigned deals and daily actions.</p>
    </RequireRole>
  );
}