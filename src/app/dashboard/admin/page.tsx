"use client";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminPage() {
  return (
    <RequireRole allow={["admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />
        <h1>Admin Dashboard</h1>
        <p>You have admin access.</p>
      </main>
    </RequireRole>
  );
}
