"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  if (typeof window === "undefined") return null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();

    const { auth } = await import("@/lib/firebase/config");
    const { signInWithEmailAndPassword } = await import("firebase/auth");

    if (!auth) return alert("Auth not ready");

    await signInWithEmailAndPassword(auth, email, password);
    router.push("/dashboard");
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
        />
        <br />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
