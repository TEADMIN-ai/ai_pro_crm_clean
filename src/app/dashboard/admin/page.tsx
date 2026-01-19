"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import HeroBanner from "@/components/ui/HeroBanner";

type Deal = {
  id: string;
  status: string;
  companyId: string;
};

export default function AdminDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDeals = async () => {
      const q = query(collection(db, "deals"));
      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }))
      );
      setLoading(false);
    };

    loadDeals();
  }, []);

  const totalDeals = deals.length;
  const openDeals = deals.filter((d) => d.status === "open").length;
  const wonDeals = deals.filter((d) => d.status === "won").length;

  if (loading) {
    return <div style={{ padding: 32 }}>Loading admin dashboard…</div>;
  }

  return (
    <RequireRole allow={["admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        {/* 🔥 Hero Banner */}
        <HeroBanner role="admin" />

        {/* 📊 KPI Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <KpiCard label="Total Deals" value={totalDeals} />
          <KpiCard label="Open Deals" value={openDeals} />
          <KpiCard label="Won Deals" value={wonDeals} />
        </section>

        {/* ℹ️ Admin Note */}
        <section
          style={{
            marginTop: 32,
            padding: 20,
            borderRadius: 12,
            background: "#0f172a",
            color: "#e5e7eb",
          }}
        >
          <h3 style={{ marginBottom: 8 }}>Admin Controls</h3>
          <p style={{ opacity: 0.8 }}>
            You have full visibility across companies, users, and deals.
          </p>
        </section>
      </main>
    </RequireRole>
  );
}

/* 🔹 KPI Card Component */
function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#020617",
        color: "#f8fafc",
        padding: 20,
        borderRadius: 14,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}