"use client";

import { useAuthContext } from "@/context/AuthContext";

export default function DashboardHeader() {
  const { user } = useAuthContext();

  return (
    <header
      style={{
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(10px)",
      }}
    >
      <strong style={{ color: "#fff" }}>Torque Empire</strong>

      {user && (
        <span style={{ opacity: 0.75, fontSize: 14 }}>
          {user.email}
        </span>
      )}
    </header>
  );
}