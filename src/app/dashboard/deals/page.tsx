"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

import { Deal } from "@/lib/deals/types";
import {
  DEAL_STATUSES,
  DEAL_STATUS_LABELS,
  DealStatus,
} from "@/lib/deals/status";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snapshot = await getDocs(collection(db, "deals"));
        const results: Deal[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));
        setDeals(results);
      } catch (err) {
        console.error("Failed to load deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Deals</h1>

      {loading && <p>Loading deals…</p>}

      {!loading && deals.length === 0 && <p>No deals found.</p>}

      {!loading && deals.length > 0 && (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Reference</th>
              <th>Client</th>
              <th>Status</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id}>
                <td>{deal.title}</td>
                <td>{deal.reference ?? "-"}</td>
                <td>{deal.client ?? "-"}</td>
                <td>{DEAL_STATUS_LABELS[deal.status]}</td>
                <td>{deal.value ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}