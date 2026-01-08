"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

type DealStatus = "draft" | "submitted" | "awarded" | "lost";

type Deal = {
  id: string;
  title: string;
  status: DealStatus;
  assignedTo: string;
};

const DEAL_STATUSES: DealStatus[] = [
  "draft",
  "submitted",
  "awarded",
  "lost",
];

export default function StaffDashboard() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("assignedTo", "==", user.uid),
        where("companyId", "==", user.companyId)
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

  const updateStatus = async (dealId: string, newStatus: DealStatus) => {
    setUpdatingId(dealId);

    await updateDoc(doc(db, "deals", dealId), {
      status: newStatus,
    });

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, status: newStatus } : d
      )
    );

    setUpdatingId(null);
  };

  return (
    <RequireRole allow={["staff"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Staff Dashboard</h1>

        <p>
          <strong>User:</strong> {user?.email}
          <br />
          <strong>Role:</strong> {user?.role}
          <br />
          <strong>Company:</strong> {user?.companyId}
        </p>

        <hr />

        <h2>My Deals</h2>

        {loading && <p>Loading deals...</p>}

        {!loading && deals.length === 0 && (
          <p>No deals assigned to you.</p>
        )}

        <ul>
          {deals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: 16 }}>
              <strong>{deal.title}</strong>
              <br />
              Status:{" "}
              <select
                value={deal.status}
                disabled={updatingId === deal.id}
                onChange={(e) =>
                  updateStatus(
                    deal.id,
                    e.target.value as DealStatus
                  )
                }
              >
                {DEAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </main>
    </RequireRole>
  );
}