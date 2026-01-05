"use client";

import RequireRole from "@/components/auth/RequireRole";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";

type Deal = {
  id: string;
  title: string;
  reference?: string;
  client?: string;
  status: "draft" | "in_review" | "submitted" | "awarded" | "lost";
  value?: number;
  createdAt?: any;
};

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const results: Deal[] = snap.docs.map((doc) => ({
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

    loadDeals();
  }, []);

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 40 }}>
        <h1>Manager Dashboard</h1>
        <p>Overview of all deals (read-only)</p>

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
                  <td>{deal.reference || "-"}</td>
                  <td>{deal.client || "-"}</td>
                  <td>{deal.status}</td>
                  <td>{deal.value ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RequireRole>
  );
}