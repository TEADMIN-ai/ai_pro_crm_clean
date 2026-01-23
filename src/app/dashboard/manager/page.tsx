"use client";

export default function ManagerDashboardPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        background:
          "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        color: "#e5e7eb",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        Manager Dashboard
      </h1>

      <p
        style={{
          opacity: 0.75,
          marginBottom: "24px",
        }}
      >
        Monitor deals, performance, and pipeline health
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <Kpi label="Total Deals" value={0} />
        <Kpi label="Unassigned Deals" value={0} />
        <Kpi label="Won Deals" value={0} />
        <Kpi label="Lost Deals" value={0} />
      </div>

      <div
        style={{
          marginTop: "32px",
          padding: "20px",
          borderRadius: "14px",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <strong>Next step</strong>
        <p style={{ opacity: 0.75, marginTop: 6 }}>
          Charts, live data, and advanced analytics will be enabled in Phase 2.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          opacity: 0.75,
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "30px",
          fontWeight: 700,
          color: "#38bdf8",
        }}
      >
        {value}
      </div>
    </div>
  );
}