"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import HeroBanner from "@/components/hero/HeroBanner";
import PipelineChart from "@/components/charts/PipelineChart";

import { getHeroImage } from "@/config/heroRules";
import type { Deal } from "@/types/deal";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.20)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.9, color: "rgba(255,255,255,0.90)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
        {value}
      </div>
    </div>
  );
}

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, "deals"));
        const data: Deal[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Deal, "id">),
        }));
        setDeals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load deals", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  const totalDeals = deals.length;

  const unassignedDeals = useMemo(() => {
    return deals.filter((d) => {
      const owner = d.ownerId ?? d.assignedTo ?? "";
      return String(owner).trim() === "";
    }).length;
  }, [deals]);

  const wonDeals = useMemo(() => deals.filter((d) => d.stage === "won").length, [deals]);
  const lostDeals = useMemo(() => deals.filter((d) => d.stage === "lost").length, [deals]);

  const isMonthEnd = new Date().getDate() >= 25;

  // data-driven hero selection
  const heroImage = getHeroImage({
    role: "manager",
    totalDeals,
    unassignedDeals,
    isMonthEnd,
  });

  return (
    <div style={{ padding: 24 }}>
      <HeroBanner
        title="Manager Dashboard"
        subtitle="Monitor deals, performance, and pipeline health"
        backgroundImage={heroImage}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <KpiCard label="Total Deals" value={totalDeals} />
        <KpiCard label="Unassigned" value={unassignedDeals} />
        <KpiCard label="Won" value={wonDeals} />
        <KpiCard label="Lost" value={lostDeals} />
      </div>

      <div style={{ marginTop: 24 }}>
        <PipelineChart deals={deals} />
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
          Recent Deals
        </h3>

        {loading && <div style={{ color: "rgba(255,255,255,0.85)" }}>Loading deals…</div>}

        {!loading && deals.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.85)" }}>No deals found.</div>
        )}

        {!loading &&
          deals.slice(0, 5).map((deal) => (
            <div
              key={deal.id}
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
                marginBottom: 10,
              }}
            >
              <strong style={{ color: "#fff" }}>{deal.title ?? "Untitled deal"}</strong>
              <div style={{ opacity: 0.9, fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Stage: {deal.stage ?? "unknown"}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}