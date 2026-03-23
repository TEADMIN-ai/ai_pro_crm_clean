"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardHeader() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Check console.");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "24px 24px 0",
      }}
    >
      <button
        onClick={handleLogout}
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          background: "#2563eb",
          color: "white",
          border: "1px solid #2563eb",
          cursor: "pointer",
          fontWeight: 700,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
        }}
      >
        Logout
      </button>
    </div>
  );
}
