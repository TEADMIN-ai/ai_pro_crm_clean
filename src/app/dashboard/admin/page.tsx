"use client";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import RoleHeroBanner from "@/components/ui/RoleHeroBanner";

export default function AdminPage() {
  return (
    <RequireRole allow={["admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />
        <RoleHeroBanner />

        <h2 style={{ marginTop: 24 }}>System Administration</h2>
        <p>
          Full system control, user management, reporting, and configuration.
        </p>
      </main>
    </RequireRole>
  );
}