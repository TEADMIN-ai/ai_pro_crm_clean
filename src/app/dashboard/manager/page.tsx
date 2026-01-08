"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { logDealActivity } from "@/lib/dealActivity";

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
  const { user, loading } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [busyDealId, setBusyDealId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Load company deals
      const dealsQuery = query(
        collection(db, "deals"),
        where("companyId", "==", user.companyId),
        orderBy("createdAt", "desc")
      );

      const dealsSnap = await getDocs(dealsQuery);
      setDeals(
        dealsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );

      // Load staff users
      const staffQuery = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId),
        where("role", "==", "staff")
      );

      const staffSnap = await getDocs(staffQuery);
      setStaff(
        staffSnap.docs.map((u) => ({
          uid: u.id,
          email: u.data().email,
        }))
      );
    };

    loadData();
  }, [user]);

  const handleAssignmentChange = async (
    deal: Deal,
    newUid: string | null
  ) => {
    if (!user) return;

    try {
      setBusyDealId(deal.id);

      const dealRef = doc(db, "deals", deal.id);
      const previousUid = deal.assignedTo ?? null;

      await updateDoc(dealRef, {
        assignedTo: newUid,
      });

      await logDealActivity(
        deal.id,
        user,
        "assignment_change",
        previousUid,
        newUid
      );

      setDeals((prev) =>
        prev.map((d) =>
          d.id === deal.id ? { ...d, assignedTo: newUid ?? undefined } : d
        )
      );
    } finally {
      setBusyDealId(null);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Access denied</p>;

  return (
    <RequireRole allow={["manager"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>
        <p>Company pipeline overview</p>

        {deals.length === 0 && <p>No deals found.</p>}

        <ul>
          {deals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: 20 }}>
              <strong>{deal.title}</strong>
              <div>Status: {deal.status}</div>

              <label>
                Assign to:{" "}
                <select
                  value={deal.assignedTo ?? ""}
                  disabled={busyDealId === deal.id}
                  onChange={(e) =>
                    handleAssignmentChange(
                      deal,
                      e.target.value || null
                    )
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