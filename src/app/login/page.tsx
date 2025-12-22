'use client';

"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { createUserInFirestore } from "@/lib/firebase/createUserInFirestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await createUserInFirestore(cred.user);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(
        typeof err?.message === "string"
          ? err.message
          : "Login failed. Please check credentials."
      );
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 400 }}>
      <h1>Login</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <button onClick={handleLogin}>Login</button>

      {typeof error === "string" && (
        <p style={{ color: "red" }}>{error}</p>
      )}
    </div>
  );
}

