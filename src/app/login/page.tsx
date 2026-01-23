"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth(); // ✅ correct API

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
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
        background: "#0b1220",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          padding: 32,
          borderRadius: 16,
          background: "rgba(255,255,255,0.05)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          color: "#fff",
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Login</h1>
        <p style={{ opacity: 0.7, marginBottom: 24 }}>
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
            padding: "12px 14px",
            marginBottom: 14,
            borderRadius: 8,
            border: "none",
            outline: "none",
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
            padding: "12px 14px",
            marginBottom: 16,
            borderRadius: 8,
            border: "none",
            outline: "none",
          }}
        />

        {error && (
          <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 10px 25px rgba(37,99,235,0.5)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}