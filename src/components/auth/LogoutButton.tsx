"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    console.log("🔥 Logout clicked");

    try {
      await signOut(auth);

      console.log("✅ Firebase signOut completed");

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("❌ Logout failed:", error);
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