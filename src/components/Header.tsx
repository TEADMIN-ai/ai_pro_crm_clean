"use client";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { logout } = useAuth();

  return (
    <header className="app-header" style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
    }}>
      <strong style={{ color: "#fff" }}>Torque Empire</strong>

      <button
        className="logout-btn"
        onClick={logout}
      >
        Logout
      </button>
    </header>
  );
}