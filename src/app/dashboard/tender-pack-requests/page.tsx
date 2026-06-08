"use client";

import RequireRole from "@/components/auth/RequireRole";
import TenderPackRequestPanel from "@/components/tender/TenderPackRequestPanel";

export default function TenderPackRequestsPage() {
  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <main className="space-y-6 p-4 md:p-6">
        <TenderPackRequestPanel mode="review" />
      </main>
    </RequireRole>
  );
}
