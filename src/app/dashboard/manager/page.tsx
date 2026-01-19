"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import HeroBanner from "@/components/layout/HeroBanner";

/* ================= Types ================= */

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string | null;
  createdAt?: any;
};

/* ================= Page ================= */

export default function ManagerDashboardPage() {
  const { user, loading: authLoading } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- Load deals ---------- */
  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("companyId", "==", user.companyId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );

      setLoading(false);
    };

    loadDeals();
  }, [user]);

  if (authLoading || loading) {
    return <div style={{ padding: 32 }}>Loading manager dashboard…</div>;
  }

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        {/* ===== HERO ===== */}
        <HeroBanner
          role="manager"
          title="Manager Dashboard"
          subtitle="Team performance, pipeline visibility, and activity oversight"
        />

        {/* ===== KPI CARDS ===== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <KpiCard label="Total Deals" value={deals.length} />
          <KpiCard
            label="Unassigned"
            value={deals.filter((d) => !d.assignedTo).length}
          />
          <KpiCard
            label="Active"
            value={deals.filter((d) => d.status !== "closed").length}
          />
        </div>

        {/* ===== DEAL LIST ===== */}
        <h2 style={{ marginBottom: 12 }}>Deals</h2>

        {deals.length === 0 && (
          <div style={{ opacity: 0.7 }}>No deals found.</div>
        )}

        {deals.map((deal) => (
          <div
            key={deal.id}
            style={{
              border: "1px solid #2a2f45",
              background: "#121a2f",
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <strong>{deal.title}</strong>
            <div style={{ opacity: 0.8 }}>Status: {deal.status}</div>
            <div style={{ opacity: 0.7 }}>
              Assigned to: {deal.assignedTo || "Unassigned"}
            </div>
          </div>
        ))}
      </main>
    </RequireRole>
  );
}

/* ================= Components ================= */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#0f1629",
        border: "1px solid #2a2f45",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div style={{ opacity: 0.7, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}