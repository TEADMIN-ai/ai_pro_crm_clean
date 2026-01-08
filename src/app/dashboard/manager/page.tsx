"use client";

import RequireRole from "@/components/auth/RequireRole";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function ManagerDashboardPage() {
  return (
    <RequireRole allow={["manager", "admin"]}>
      <DashboardHeader />

      <main style={{ padding: 24 }}>
        <h1>Manager Dashboard</h1>

        <p style={{ opacity: 0.8 }}>
          Welcome. This dashboard will show all company deals,
          tender statuses, and performance metrics.
        </p>

        {/* Step 2 will add Deals List here */}
      </main>
    </RequireRole>
  );
}