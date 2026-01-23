"use client";

import { ReactNode } from "react";
import Header from "@/components/Header";

type Props = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background:
          "linear-gradient(135deg, #cfe8ff 0%, #6b7c8f 45%, #0b1220 100%)",
      }}
    >
      {/* GLOBAL HEADER — LOGOUT LIVES HERE */}
      <Header />

      {/* PAGE CONTENT */}
      <main
        style={{
          padding: "32px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}