"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Deal } from "@/types/deal";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import HeroBanner from "@/components/hero/HeroBanner";

import { getHeroImage } from "@/config/heroRules";
import { useKPIs } from "@/hooks/useKPIs";

/* =========================
   MANAGER DASHBOARD
========================= */

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const data: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));

        setDeals(data);
      } catch (err) {
        console.error("Failed to load deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  /* =========================
     DATA FOR HERO + KPIs
  ========================= */

  const totalDeals = deals.length;
  const unassignedDeals = deals.filter((d) => !d.ownerId).length;
  const isMonthEnd = new Date().getDate() >= 25;

  const heroImage = getHeroImage({
    role: "manager",
    totalDeals,
    unassignedDeals,
    isMonthEnd,
  });

  const kpis = useKPIs(deals, "manager");

  /* =========================
     RENDER
  ========================= */

  return (
    <RequireRole allow={["manager", "admin"]}>
      <div style={{ padding: 24 }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div />
          <LogoutButton />
        </div>

        {/* HERO */}
        <HeroBanner
          image={heroImage}
          title="Manager Dashboard"
          subtitle="Monitor deals, performance, and pipeline health"
        />

        {/* KPI ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.key}
              label={kpi.label}
              value={kpi.value}
            />
          ))}
        </div>

        {/* RECENT DEALS */}
        <div style={{ marginTop: 36 }}>
          <h3 style={{ marginBottom: 12 }}>Recent Deals</h3>

          {loading && <div>Loading deals…</div>}

          {!loading && deals.length === 0 && (
            <div>No deals found.</div>
          )}

          {!loading &&
            deals.slice(0, 5).map((deal) => (
              <div
                key={deal.id}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  marginBottom: 12,
                }}
              >
                <strong>{deal.title}</strong>
                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  Stage: {deal.stage}
                </div>
              </div>
            ))}
        </div>
      </div>
    </RequireRole>
  );
}

/* =========================
   KPI CARD
========================= */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    </div>
  );
}