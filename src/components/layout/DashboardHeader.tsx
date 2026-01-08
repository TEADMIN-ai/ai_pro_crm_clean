"use client";

import LogoutButton from "@/components/auth/LogoutButton";
import { useAuthContext } from "@/context/AuthContext";

export default function DashboardHeader() {
  const { user } = useAuthContext();

  if (!user) return null;

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #e5e5e5",
        marginBottom: 24,
      }}
    >
      <div>
        <strong>{user.email}</strong>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Role: {user.role}
        </div>
      </div>

      <LogoutButton />
    </header>
  );
}