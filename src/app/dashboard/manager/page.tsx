"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  createdAt?: any;
};

type UserMap = Record<string, string>; // uid -> email

export default function ManagerDashboardPage() {
  const router = useRouter();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // 🔹 Load users (for UID → email resolution)
      const usersSnap = await getDocs(collection(db, "users"));
      const userMap: UserMap = {};

      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.email) {
          userMap[doc.id] = data.email;
        }
      });

      setUsers(userMap);

      // 🔹 Load deals
      const dealsQuery = query(
        collection(db, "deals"),
        orderBy("createdAt", "desc")
      );

      const dealsSnap = await getDocs(dealsQuery);

      setDeals(
        dealsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading manager dashboard…</div>;
  }

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>

        {deals.length === 0 && (
          <p style={{ opacity: 0.6 }}>No deals found.</p>
        )}

        {deals.map((deal) => {
          const assignedLabel =
            deal.assignedTo && users[deal.assignedTo]
              ? users[deal.assignedTo]
              : "Unassigned";

          return (
            <div
              key={deal.id}
              style={{
                border: "1px solid #ddd",
                padding: 16,
                marginBottom: 16,
                borderRadius: 6,
              }}
            >
              <strong>{deal.title}</strong>

              <div>Status: {deal.status}</div>

              <div>Assigned to: {assignedLabel}</div>

              <button
                style={{ marginTop: 10 }}
                onClick={() =>
                  router.push(`/dashboard/deals/${deal.id}`)
                }
              >
                View activity
              </button>
            </div>
          );
        })}
      </main>
    </RequireRole>
  );
}