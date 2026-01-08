"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuthContext } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
};

type StaffUser = {
  uid: string;
  email: string;
};

export default function ManagerDashboardPage() {
  const { user } = useAuthContext();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load staff users
  useEffect(() => {
    if (!user) return;

    const loadStaff = async () => {
      const q = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId),
        where("role", "==", "staff")
      );

      const snap = await getDocs(q);
      setStaff(
        snap.docs.map((d) => ({
          uid: d.data().uid,
          email: d.data().email,
        }))
      );
    };

    loadStaff();
  }, [user]);

  // Load company deals
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
          ...d.data(),
        })) as Deal[]
      );

      setLoading(false);
    };

    loadDeals();
  }, [user]);

  const assignDeal = async (dealId: string, staffUid: string) => {
    const ref = doc(db, "deals", dealId);
    if (staffUid) {
  await updateDoc(ref, { assignedTo: staffUid });
} else {
  await updateDoc(ref, { assignedTo: null });
}

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, assignedTo: staffUid } : d
      )
    );
  };

  if (loading) return <p>Loading…</p>;

  return (
    <RequireRole allow={["manager"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>
        <p>Company pipeline overview</p>

        {deals.length === 0 && <p>No deals found.</p>}

        <ul>
          {deals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: 16 }}>
              <strong>{deal.title}</strong>
              <br />
              Status: {deal.status}
              <br />

              <label>
                Assign to:&nbsp;
                <select
                  value={deal.assignedTo || ""}
                  onChange={(e) =>
                    assignDeal(deal.id, e.target.value)
                  }
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.email}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      </main>
    </RequireRole>
  );
}