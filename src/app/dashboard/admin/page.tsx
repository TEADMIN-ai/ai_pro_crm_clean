"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AdminDashboardPage() {
  return (
    <DashboardLayout>
      <div style={{ padding: "24px" }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#ffffff",
            textShadow: "0 2px 6px rgba(0,0,0,0.35)",
          }}
        >
          Admin Dashboard
        </h1>

        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Full visibility across companies, users, and deals
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <KpiCard label="Total Deals" value={0} />
          <KpiCard label="Companies" value={0} />
          <KpiCard label="Users" value={0} />
        </div>

        <div
          style={{
            marginTop: 32,
            padding: 20,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <h3>Admin Controls</h3>
          <p style={{ opacity: 0.8 }}>
            Administrative analytics and controls will expand in Phase 3.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "rgba(255,255,255,0.07)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>{label}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          marginTop: 4,
          color: "#38bdf8",
        }}
      >
        {value}
      </div>
    </div>
  );
}
