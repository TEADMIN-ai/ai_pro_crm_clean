"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import RequireRole from "@/components/auth/RequireRole";
import { useAuth } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  reference?: string;
  clientName?: string;
  status: string;
  ownerId?: string;
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          where("ownerId", "==", user.uid)
        );

        const snapshot = await getDocs(q);
        const results: Deal[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));

        setDeals(results);
      } catch (err) {
        console.error("Failed to load staff deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [user]);

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>Staff Dashboard</h1>

        {loading && <p>Loading deals…</p>}

        {!loading && deals.length === 0 && (
          <p>No deals assigned to you yet.</p>
        )}

        {!loading && deals.length > 0 && (
          <table
            border={1}
            cellPadding={8}
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th align="left">Title</th>
                <th align="left">Reference</th>
                <th align="left">Client</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.title}</td>
                  <td>{deal.reference || "-"}</td>
                  <td>{deal.clientName || "-"}</td>
                  <td>{deal.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RequireRole>
  );
}