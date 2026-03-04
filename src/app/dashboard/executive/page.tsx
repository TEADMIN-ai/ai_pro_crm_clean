"use client";

import RequireRole from "@/components/auth/RequireRole";
import ExecutiveDashboard from "@/components/executive/ExecutiveDashboard";

export default function ExecutivePage() {
  return (
    <RequireRole allow={["admin"]}>
      <ExecutiveDashboard />
    </RequireRole>
  );
}