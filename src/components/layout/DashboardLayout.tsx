"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}