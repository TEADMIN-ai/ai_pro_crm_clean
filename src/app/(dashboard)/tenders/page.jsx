"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function TendersPage() {
  if (typeof window === "undefined") return null;
  const [tenders, setTenders] = useState([]);

  useEffect(() => {
    let unsub;

    async function load() {
      const { db } = await import("@/lib/firebase/config");
      const { collection, onSnapshot } = await import("firebase/firestore");

      if (!db) return;

      unsub = onSnapshot(collection(db, "tenders"), snap => {
        setTenders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    load();
    return () => unsub && unsub();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>ðŸ“„ Tenders</h1>
      <ul>
        {tenders.map(t => (
          <li key={t.id}>{t.id}</li>
        ))}
      </ul>
    </div>
  );
}
