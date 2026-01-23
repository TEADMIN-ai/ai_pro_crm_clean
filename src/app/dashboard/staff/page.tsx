"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function StaffDashboardPage() {
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
          Staff Dashboard
        </h1>

        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Your assigned deals and daily actions
        </p>

        {/* KPI ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <KpiCard label="My Deals" value={0} />
          <KpiCard label="Open" value={0} />
          <KpiCard label="Won" value={0} />
          <KpiCard label="Lost" value={0} />
        </div>

        {/* EMPTY STATE */}
        <div
          style={{
            marginTop: 32,
            padding: 20,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <p style={{ opacity: 0.75 }}>
            No deals assigned yet — activity will appear here once deals are allocated to you.
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