"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import KpiRow from "@/components/dashboard/KpiRow";

type Deal = {
  id: string;
  status: string;
};

export default function ManagerDashboardPage() {
  const { user, loading } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          where("companyId", "==", user.companyId)
        );

        const snap = await getDocs(q);
        const list: Deal[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }));

        setDeals(list);
      } catch (err) {
        console.error("Failed to load manager deals", err);
      } finally {
        setLoadingData(false);
      }
    };

    loadDeals();
  }, [user]);

  if (loading || loadingData) {
    return <div>Loading KPIs...</div>;
  }

  const kpis = [
    { label: "NEW", value: deals.filter((d) => d.status === "new").length },
    {
      label: "CONTACTED",
      value: deals.filter((d) => d.status === "contacted").length,
    },
    {
      label: "NEGOTIATION",
      value: deals.filter((d) => d.status === "negotiation").length,
    },
    { label: "WON", value: deals.filter((d) => d.status === "won").length },
    { label: "LOST", value: deals.filter((d) => d.status === "lost").length },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Manager Dashboard</h1>
      <p style={{ opacity: 0.7, marginBottom: 32 }}>
        Monitor your team, deals, SLAs, and revenue performance.
      </p>

      <KpiRow kpis={kpis} />
    </div>
  );
}