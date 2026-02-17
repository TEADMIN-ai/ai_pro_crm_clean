"use client";

import { useAuth } from "@/context/AuthContext";

export default function RoleHeroBanner() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div
      style={{
        padding: 24,
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.35), rgba(15,23,42,0.85))",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        marginBottom: 24,
      }}
    >
      <h2 style={{ marginBottom: 6 }}>
        Welcome back
      </h2>
      <p style={{ opacity: 0.8 }}>
        Intelligence That Drives Revenue
      </p>
    </div>
  );
}

