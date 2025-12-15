"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function CarSalesPage() {
  if (typeof window === "undefined") return null;
  const [sales, setSales] = useState([]);

  useEffect(() => {
    let unsub;

    async function load() {
      const { db } = await import("@/lib/firebase/config");
      const { collection, onSnapshot } = await import("firebase/firestore");

      if (!db) return;

      unsub = onSnapshot(collection(db, "carsales"), snap => {
        setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    load();
    return () => unsub && unsub();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>ðŸš— Car Sales</h1>
      <ul>
        {sales.map(s => (
          <li key={s.id}>{s.id}</li>
        ))}
      </ul>
    </div>
  );
}
