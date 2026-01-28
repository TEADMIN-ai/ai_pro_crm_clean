"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import HeroBanner from "@/components/hero/HeroBanner";
import PipelineChart from "@/components/charts/PipelineChart";
import RevenueKpiRow from "@/components/kpi/RevenueKpiRow";

import { getHeroImage } from "@/config/heroRules";
import { useRevenueKpis } from "@/hooks/useRevenueKpis";

import type { Deal } from "@/types/deal";

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, "deals"));
        const data: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));
        setDeals(data);
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
    return deals.filter(
      (d) => !d.assignedTo || String(d.assignedTo).trim() === ""
    ).length;
  }, [deals]);

  const heroImage = getHeroImage({
    role: "manager",
    totalDeals,
    unassignedDeals,
    isMonthEnd: new Date().getDate() >= 25,
  });

  const kpis = useRevenueKpis(deals);

  return (
    <div style={{ padding: 24 }}>
      <HeroBanner
        image={heroImage}
        title="Manager Dashboard"
        subtitle="Revenue, pipeline health, and execution velocity"
      />

      <RevenueKpiRow kpis={kpis} />

      <div style={{ marginTop: 22 }}>
        <PipelineChart deals={deals} />
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 12 }}>Recent Deals</h3>

        {loading && <div>Loading deals…</div>}
        {!loading && deals.length === 0 && <div>No deals found.</div>}

        {!loading &&
          deals.slice(0, 6).map((deal) => (
            <div
              key={deal.id}
              style={{
                padding: 16,
                borderRadius: 14,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                marginBottom: 10,
                boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
              }}
            >
              <strong>{deal.title}</strong>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Stage: {deal.stage} • Value: ZAR{" "}
                {(deal.value ?? 0).toLocaleString("en-ZA")}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}