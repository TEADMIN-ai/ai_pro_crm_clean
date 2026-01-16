"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuthContext, type AuthUser } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo: string;
  createdAt?: any;
};

export default function StaffDashboardPage() {
  const { user, loading } = useAuthContext();
  const authedUser = user as AuthUser | null;

  const [deals, setDeals] = useState<Deal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authedUser) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("assignedTo", "==", authedUser.uid),
        where("companyId", "==", authedUser.companyId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setDeals(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Deal, "id">),
        }))
      );

      setDataLoading(false);
    };

    loadDeals();
  }, [authedUser]);

  if (loading || dataLoading) {
    return <div style={{ padding: 32 }}>Loading staff dashboard…</div>;
  }

  return (
    <RequireRole allow={["staff"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>My Deals</h1>

        {deals.length === 0 && (
          <p style={{ opacity: 0.6 }}>No deals assigned to you.</p>
        )}

        {deals.map((deal) => (
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
          </div>
        ))}
      </main>
    </RequireRole>
  );
}