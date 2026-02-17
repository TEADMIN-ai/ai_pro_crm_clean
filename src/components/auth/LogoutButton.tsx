"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        background: "#38bdf8",
        color: "#0f172a",
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}

