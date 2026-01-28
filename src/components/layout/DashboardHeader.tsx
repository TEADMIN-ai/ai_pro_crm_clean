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
        background: "linear-gradient(135deg, #2563eb, #1e40af)",
        color: "#ffffff",
        border: "none",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      Logout
    </button>
  );
}