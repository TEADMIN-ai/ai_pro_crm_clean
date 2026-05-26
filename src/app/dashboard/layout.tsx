"use client";

import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayoutShell from "@/components/layout/DashboardLayout";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardLayoutShell>
      <AuthGuard>{children}</AuthGuard>
    </DashboardLayoutShell>
  );
}
