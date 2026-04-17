"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function LoginPage() {
  console.log("📍 LoginPage mounted");

  const router = useRouter();
  const authState = useAuthUser();

  console.log("🧠 Hook state:", authState);

  const { user, role, loading } = authState;

  // 🔍 FULL DEBUG
  useEffect(() => {
    console.log("🧠 LOGIN STATE:", {
      user,
      role,
      loading,
    });

    if (loading) return;

    if (!user) {
      console.log("❌ No user yet");
      return;
    }

    if (!role) {
      console.log("⏳ Waiting for role...");
      return;
    }

    console.log("🚀 Redirecting to dashboard...");
    router.replace("/dashboard");
  }, [loading, role, router, user]);

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      
      {/* 🎥 Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/login/logo.png"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      >
        <source src="/login/hero.mp4" type="video/mp4" />
      </video>

      {/* 🌓 Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top, rgba(15,23,42,0.75), rgba(2,6,23,0.95))",
          zIndex: 1,
        }}
      />

      {/* 🔐 Login Card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(15, 23, 42, 0.72)",
            color: "#E2E8F0",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            backdropFilter: "blur(8px)",
          }}
        >
          {loading && "🔄 Checking authentication..."}

          {!loading && !user && "🔐 Please sign in."}

          {!loading && user && !role && "⏳ Logged in, fetching role..."}

          {!loading && user && role && "✅ Auth complete. Redirecting..."}
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
