"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";

type Deal = {
  id: string;
  title: string;
  status: string;
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setDeals(
        snap.docs.map((doc) => ({
          ...(doc.data() as Omit<Deal, "id">),
          id: doc.id, // ✅ ID SET LAST — NO OVERWRITE
        }))
      );
    };

    loadDeals();
  }, []);

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 32 }}>
        <h1>All Deals</h1>

        {deals.map((deal) => (
          <div
            key={deal.id}
            style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <strong>{deal.title}</strong>
            <div>Status: {deal.status}</div>
          </div>
        ))}
      </main>
    </RequireRole>
  );
}
