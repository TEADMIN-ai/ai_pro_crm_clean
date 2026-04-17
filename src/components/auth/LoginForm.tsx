"use client";

import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

const POST_LOGIN_BOOT_KEY = "show_ai_boot";

export default function LoginForm() {
  const auth = getAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken(true);

      console.info("[LoginForm] Firebase sign-in succeeded", {
        uid: credential.user.uid,
        email: credential.user.email,
      });

      await authFetch(API_ROUTES.AUTH_LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      console.info("[LoginForm] Session cookie created successfully");
      window.sessionStorage.setItem(POST_LOGIN_BOOT_KEY, "true");
      console.info("[LoginForm] Waiting for authenticated redirect");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
      }}
    >
      <input
        type="email"
        placeholder="Email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        required
        onChange={(e) => setPassword(e.target.value)}
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      {error && <div style={{ color: "red", fontSize: 14 }}>{error}</div>}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 8,
          background: "#2563eb",
          color: "#fff",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
