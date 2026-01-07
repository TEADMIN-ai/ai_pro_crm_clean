"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import RequireRole from "@/components/auth/RequireRole";
import { useAuthContext } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

type Deal = {
  id: string;
  title: string;
  reference?: string;
  clientName?: string;
  status: string;
};

export default function ManagerDashboardPage() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("companyId", "==", user.companyId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );
      setLoading(false);
    };

    loadDeals();
  }, [user]);

  return (
    <RequireRole allow={["manager"]}>
      <main style={{ padding: 32 }}>
        <h1>Manager Dashboard</h1>

        {loading ? (
          <p>Loading deals...</p>
        ) : deals.length === 0 ? (
          <p>No deals found.</p>
        ) : (
          <table border={1} cellPadding={8} style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Reference</th>
                <th>Client</th>
                <th>Status</th>
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