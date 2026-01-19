"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import RoleHeroBanner from "@/components/ui/RoleHeroBanner";

type Deal = {
  id: string;
  title: string;
  status: string;
};

export default function StaffDashboardPage() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("assignedTo", "==", user.uid)
      );

      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }))
      );

      setLoading(false);
    };

    loadDeals();
  }, [user]);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading your deals…</div>;
  }

  return (
    <RequireRole allow={["staff"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />
        <RoleHeroBanner />

        <h2 style={{ marginTop: 24 }}>My Assigned Deals</h2>

        {deals.length === 0 && (
          <p>No deals assigned yet.</p>
        )}

        {deals.map((deal) => (
          <div
            key={deal.id}
            style={{
              border: "1px solid #2a2a2a",
              padding: 16,
              marginTop: 16,
              borderRadius: 8,
              background: "#111",
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