"use client";

import { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #050b1a 0%, #030712 100%)",
        color: "#e5e7eb",
      }}
    >
      {children}
    </div>
  );
}