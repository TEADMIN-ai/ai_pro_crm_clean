"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.3)",
        background: "linear-gradient(135deg,#38bdf8,#2563eb)",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}