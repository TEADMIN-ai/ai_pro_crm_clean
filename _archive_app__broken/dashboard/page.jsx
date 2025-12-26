"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import TestContacts from "@/components/TestContacts";
import DealsList from "@/components/DealsList";

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
    return <div style={{ padding: 24 }}>Loading dashboard…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-end">
        <LogoutButton />
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">📊 Firebase Stats</h1>
        <ul className="list-disc ml-5 space-y-1">
          <li>📁 Tenders: {stats.tenders}</li>
          <li>🧑‍🤝‍🧑 Contractors: {stats.contractors}</li>
          <li>🚗 Car Sales: {stats.carsales}</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-4 mb-2">📇 Dolibarr Contacts</h2>
        <TestContacts />
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-4 mb-2">📁 Dolibarr Deals</h2>
        <DealsList />
      </div>
    </div>
  );
}
