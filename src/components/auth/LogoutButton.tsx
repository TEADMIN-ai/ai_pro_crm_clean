"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_ROUTES } from "@/lib/routes";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await fetch(API_ROUTES.AUTH_LOGOUT, {
        method: "POST",
        credentials: "include",
      });

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Logout failed. Check console.");
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        background: "#2563eb",
        color: "white",
        padding: "8px 16px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}
