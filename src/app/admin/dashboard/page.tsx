"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type AdminStats = {
  contractors: number;
};

export default function AdminDashboard() {
  if (typeof window === "undefined") return null;
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    async function load() {
      const { db } = await import("@/lib/firebase/config");
      const { collection, getDocs } = await import("firebase/firestore");

      if (!db) return;

      const snap = await getDocs(collection(db, "contractors"));

      setStats({
        contractors: snap.size,
      });
    }

    load();
  }, []);

  if (!stats) {
    return <div style={{ padding: 24 }}>Loading admin dashboardâ€¦</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Dashboard</h1>
      <p>ðŸ‘· Contractors: {stats.contractors}</p>
    </div>
  );
}
