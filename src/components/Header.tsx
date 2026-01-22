"use client";

import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <strong style={{ color: "#fff" }}>Torque Empire</strong>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
          {user?.email ?? ""}
        </span>

        <button
          onClick={handleLogout}
          style={{
            background: "#2563eb",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: "10px",
            fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 6px 18px rgba(0,0,0,.25)",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}