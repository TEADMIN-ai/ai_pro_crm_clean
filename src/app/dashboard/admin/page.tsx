"use client";

import RequireRole from "@/components/auth/RequireRole";

export default function AdminDashboard() {
  return (
    <RequireRole allow={["admin"]}>
      <h1>Admin Dashboard</h1>
      <p>Full visibility across companies, users, and deals.</p>
    </RequireRole>
  );
}