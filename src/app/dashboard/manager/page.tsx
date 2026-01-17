"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  status: string;
};

export default function ManagerDashboard() {
  const { user, loading } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    // ⛔ WAIT until auth is fully resolved
    if (loading) return;

    // ⛔ HARD STOP if not manager
    if (!user || user.role !== "manager") {
      setDataLoading(false);
      return;
    }

    const loadDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          where("companyId", "==", user.companyId)
        );

        const snap = await getDocs(q);
        const results = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }));

        setDeals(results);
      } catch (err) {
        console.error("Manager deals load failed:", err);
      } finally {
        setDataLoading(false);
      }
    };

    loadDeals();
  }, [user, loading]);

  // 🔄 AUTH LOADING
  if (loading) {
    return <p>Loading manager dashboard…</p>;
  }

  // ⛔ ACCESS BLOCK
  if (!user || user.role !== "manager") {
    return <p>Access denied</p>;
  }

  // 🔄 DATA LOADING
  if (dataLoading) {
    return <p>Loading manager dashboard…</p>;
  }

  // ✅ SUCCESS
  return (
    <div>
      <h1>Manager Dashboard</h1>

      {deals.length === 0 && <p>No deals found.</p>}

      {deals.map((deal) => (
        <div key={deal.id} style={{ marginBottom: 12 }}>
          <strong>{deal.title}</strong> — {deal.status}
        </div>
      ))}
    </div>
  );
}