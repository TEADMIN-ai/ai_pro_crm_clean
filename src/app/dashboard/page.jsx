"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  if (typeof window === "undefined") return null;
  const [stats, setStats] = useState({
    tenders: 0,
    contractors: 0,
    carsales: 0,
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      // ðŸ”’ Firebase must ONLY load in the browser
      const { collection, getDocs } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/config");

      if (!db) return;

      const [tendersSnap, contractorsSnap, carsalesSnap] = await Promise.all([
        getDocs(collection(db, "tenders")),
        getDocs(collection(db, "contractors")),
        getDocs(collection(db, "car_sales")),
      ]);

      setStats({
        tenders: tendersSnap.size,
        contractors: contractorsSnap.size,
        carsales: carsalesSnap.size,
      });

      setReady(true);
    }

    load();
  }, []);

  if (!ready) {
    return <div style={{ padding: 24 }}>Loading dashboardâ€¦</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <ul>
        <li>ðŸ“„ Tenders: {stats.tenders}</li>
        <li>ðŸ‘· Contractors: {stats.contractors}</li>
        <li>ðŸš— Car Sales: {stats.carsales}</li>
      </ul>
    </div>
  );
}
