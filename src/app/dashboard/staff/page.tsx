"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuthContext } from "@/context/AuthContext";

export default function StaffDashboard() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("companyId", "==", user.companyId)
      );

      const snap = await getDocs(q);
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };

    loadDeals();
  }, [user]);

  return (
    <RequireRole allow={["staff"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />
        <h1>Staff Dashboard</h1>

        {loading && <p>Loading…</p>}

        {!loading && deals.length === 0 && <p>No deals assigned.</p>}

        {!loading && deals.length > 0 && (
          <ul>
            {deals.map(deal => (
              <li key={deal.id}>{deal.title}</li>
            ))}
          </ul>
        )}
      </main>
    </RequireRole>
  );
}