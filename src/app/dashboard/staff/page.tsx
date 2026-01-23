"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/types/deal";

export default function StaffDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const loading = false;

  const assignedDeals = deals.length;

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>Staff Dashboard</h1>
      <p style={subtitleStyle}>Your assigned deals and daily actions</p>

      {/* KPI ROW */}
      <div style={kpiGrid}>
        <KpiCard label="My Deals" value={assignedDeals} />
        <KpiCard label="Open" value={0} />
        <KpiCard label="Won" value={0} />
        <KpiCard label="Lost" value={0} />
      </div>

      {/* CONTENT */}
      <div style={cardStyle}>
        {loading && <p style={muted}>Loading your deals…</p>}
        {!loading && assignedDeals === 0 && (
          <p style={muted}>
            No deals assigned yet — activity will appear here once deals are
            allocated to you.
          </p>
        )}
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