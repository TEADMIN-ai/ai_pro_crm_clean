"use client";

export default function AdminDashboardPage() {
  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>Admin Dashboard</h1>
      <p style={subtitleStyle}>
        Full visibility across companies, users, and deals
      </p>

      {/* KPI ROW */}
      <div style={kpiGrid}>
        <KpiCard label="Total Deals" value={0} />
        <KpiCard label="Companies" value={0} />
        <KpiCard label="Users" value={0} />
        <KpiCard label="Alerts" value={0} />
      </div>

      {/* ADMIN NOTICE */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: 8 }}>Admin Controls</h3>
        <p style={muted}>
          Administrative analytics and controls will expand in Phase 3.
        </p>
      </div>
    </div>
  );
}

/* ---------- Shared Styles ---------- */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={kpiCard}>
      <span style={kpiLabel}>{label}</span>
      <span style={kpiValue}>{value}</span>
    </div>
  );
}

const pageStyle = {
  padding: 32,
};

const titleStyle = {
  fontSize: 34,
  fontWeight: 700,
};

const subtitleStyle = {
  opacity: 0.75,
  marginBottom: 24,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 20,
  marginBottom: 28,
};

const cardStyle = {
  padding: 24,
  borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(12px)",
};

const kpiCard = {
  padding: 20,
  borderRadius: 18,
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(12px)",
};

const kpiLabel = {
  fontSize: 13,
  opacity: 0.75,
};

const kpiValue = {
  fontSize: 28,
  fontWeight: 700,
  color: "#38bdf8",
};

const muted = {
  opacity: 0.65,
};