"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authFetch(API_ROUTES.AUTH_LOGOUT, {
        method: "POST",
        credentials: "include",
      });
      await signOut(auth);

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
