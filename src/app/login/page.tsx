"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getDashboardPath } from "@/lib/auth/roleRouting";

export default function LoginPage() {
  const router = useRouter();
  const authState = useAuthUser();
  const { user, role, loading, error } = authState;

  useEffect(() => {
    console.log("[LoginPage] Auth state", {
      user,
      role,
      loading,
      error,
    });

    if (loading || error) return;

    if (!user) {
      console.log("[LoginPage] No user yet");
      return;
    }

    if (role === "guest") {
      console.log("[LoginPage] Waiting for role");
      return;
    }

    const dashboardPath = getDashboardPath(role);
    console.log("[LoginPage] Redirecting to dashboard", { dashboardPath });
    router.replace(dashboardPath);
  }, [error, loading, role, router, user]);

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/images/logos/TE%20IN%20Partnership%20With%20Roar%20logo.png"
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top, rgba(15,23,42,0.75), rgba(2,6,23,0.95))",
          zIndex: 1,
        }}
      />

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
          {loading && "Checking authentication..."}

          {!loading && error && error}

          {!loading && !error && !user && "Please sign in."}

          {!loading && !error && user && role === "guest" && "Logged in, fetching role..."}

          {!loading && !error && user && role !== "guest" && "Auth complete. Redirecting..."}
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
