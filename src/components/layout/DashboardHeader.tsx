"use client";

import LogoutButton from "@/components/auth/LogoutButton";

export default function DashboardHeader() {
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

      <LogoutButton />
    </header>
  );
}