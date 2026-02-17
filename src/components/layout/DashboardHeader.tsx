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
      console.error("Logout failed", err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        background: "#2563eb",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      Logout
    </button>
  );
}