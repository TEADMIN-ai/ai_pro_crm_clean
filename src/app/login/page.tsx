"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        /* ✅ NO shorthand/longhand conflict */
        background: `
          linear-gradient(
            rgba(5, 15, 35, 0.35),
            rgba(5, 15, 35, 0.55)
          ),
          url("/login/hero.jpg")
        `,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {/* Motivational quote */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: 0.18,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: 2,
          color: "#ffffff",
          textAlign: "center",
          padding: "0 40px",
          textTransform: "uppercase",
        }}
      >
        SUCCESS COMES WHEN YOU REFUSE TO GIVE UP
      </div>

      {/* Login card */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          zIndex: 1,
          width: 420,
          padding: 36,
          borderRadius: 18,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          Torque Empire
        </h1>
        <p style={{ opacity: 0.7, marginBottom: 26 }}>
          Intelligence That Drives Revenue
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "14px 16px",
            marginBottom: 14,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            fontSize: 15,
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "14px 16px",
            marginBottom: 18,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            fontSize: 15,
          }}
        />

        {error && (
          <div style={{ color: "#dc2626", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 12px 30px rgba(37,99,235,0.5)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}