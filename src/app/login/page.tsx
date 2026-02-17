"use client";

import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
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

      {/* 🌓 Dark overlay for readability */}
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LoginForm />
      </div>
    </div>
  );
}

