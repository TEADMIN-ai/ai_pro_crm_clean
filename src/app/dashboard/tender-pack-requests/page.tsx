"use client";

import RequireRole from "@/components/auth/RequireRole";
import TenderPackBuilderWorkspace from "@/components/tender/TenderPackBuilderWorkspace";

export default function TenderPackRequestsPage() {
  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <TenderPackBuilderWorkspace />
    </RequireRole>
  );
}
