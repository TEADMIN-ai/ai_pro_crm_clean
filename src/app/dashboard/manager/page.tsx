"use client";

import RequireRole from "@/components/auth/RequireRole";

export default function ManagerDashboard() {
  return (
    <RequireRole allow={["manager", "admin"]}>
      <h1>Manager Dashboard</h1>
      <p>Monitor performance and pipeline health.</p>
    </RequireRole>
  );
}