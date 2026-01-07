"use client";

import RequireRole from "@/components/auth/RequireRole";

export default function AdminPage() {
  return (
    <RequireRole allow={["admin"]}>
      <main style={{ padding: 32 }}>
        <h1>Admin Dashboard</h1>
        <p>You have admin access.</p>
      </main>
    </RequireRole>
  );
}